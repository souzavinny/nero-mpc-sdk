import type { APIClient } from "../../transport/api-client";
import type { WebSocketClient } from "../../transport/websocket-client";
import type {
	KeyShare,
	Signature,
	SigningRequest,
	SigningResult,
	SigningSessionState,
} from "../../types";
import { SDKError } from "../../types";
import {
	type NonceCommitment,
	type NonceShare,
	combineNonceCommitments,
	computeR,
	createNonceCommitment,
	generateNonceShare,
	verifyNonceCommitment,
	verifyNonceProof,
} from "./nonce";
import {
	type PartialSignatureData,
	computePartialSignature,
	parseMessageHash,
	verifyPartialSignature,
} from "./partial-signature";

export interface SigningClientConfig {
	apiClient: APIClient;
	wsClient?: WebSocketClient;
	keyShare: KeyShare;
	partyPublicShares: Map<number, string>;
	timeout?: number;
}

export class SigningClient {
	private apiClient: APIClient;
	private wsClient?: WebSocketClient;
	private keyShare: KeyShare;
	private timeout: number;

	private state: SigningSessionState | null = null;
	private nonceShare: NonceShare | null = null;
	private receivedCommitments: Map<number, NonceCommitment> = new Map();
	private expectedPublicShares: Map<number, string> = new Map();
	private r: bigint | null = null;

	constructor(config: SigningClientConfig) {
		this.apiClient = config.apiClient;
		this.wsClient = config.wsClient;
		this.keyShare = config.keyShare;
		this.expectedPublicShares = new Map(config.partyPublicShares);
		this.timeout = config.timeout ?? 30000;
	}

	async sign(request: SigningRequest): Promise<SigningResult> {
		try {
			await this.initializeSession(request);

			await this.runNonceCommitmentPhase();

			await this.runPartialSignaturePhase();

			return await this.completeProtocol();
		} catch (error) {
			const message = error instanceof Error ? error.message : "Signing failed";
			return {
				success: false,
				error: message,
			};
		} finally {
			this.cleanup();
		}
	}

	private async initializeSession(request: SigningRequest): Promise<void> {
		const { sessionId, participatingParties } =
			await this.apiClient.initiateSigningSession(
				request.messageHash,
				request.messageType,
			);

		if (participatingParties.length < this.keyShare.threshold) {
			throw new SDKError(
				`Insufficient participating parties: got ${participatingParties.length}, need ${this.keyShare.threshold}`,
				"INSUFFICIENT_PARTIES",
			);
		}

		this.state = {
			sessionId,
			round: "nonce_commitment",
			messageHash: request.messageHash,
			participatingParties,
			nonceCommitments: new Map(),
			partialSignatures: new Map(),
		};

		this.nonceShare = generateNonceShare();

		if (this.wsClient) {
			await this.wsClient.connect();
		}
	}

	private async runNonceCommitmentPhase(): Promise<void> {
		if (!this.state || !this.nonceShare) {
			throw new SDKError("State not initialized", "STATE_ERROR");
		}

		const commitment = createNonceCommitment(
			this.keyShare.partyId,
			this.nonceShare,
		);

		await this.apiClient.submitNonceCommitment(
			this.state.sessionId,
			this.keyShare.partyId,
			JSON.stringify(commitment),
		);

		this.receivedCommitments.set(this.keyShare.partyId, commitment);

		const otherCommitments = await this.waitForNonceCommitments();

		for (const [partyId, comm] of otherCommitments) {
			if (!verifyNonceCommitment(comm)) {
				throw new SDKError(
					`Invalid nonce commitment from party ${partyId}`,
					"INVALID_NONCE_COMMITMENT",
				);
			}
			if (!verifyNonceProof(comm)) {
				throw new SDKError(
					`Invalid nonce proof from party ${partyId}`,
					"INVALID_NONCE_PROOF",
				);
			}
			this.receivedCommitments.set(partyId, comm);
		}

		const allCommitments = Array.from(this.receivedCommitments.values());
		const { R } = combineNonceCommitments(allCommitments);
		const { r } = computeR(R);
		this.r = r;

		this.state.round = "partial_signature";
	}

	private async runPartialSignaturePhase(): Promise<void> {
		if (!this.state || !this.nonceShare || this.r === null) {
			throw new SDKError("State not initialized", "STATE_ERROR");
		}

		const messageHashBigInt = parseMessageHash(this.state.messageHash);
		const keyShareBigInt = BigInt(`0x${this.keyShare.privateShare}`);

		const partial = computePartialSignature(
			this.keyShare.partyId,
			keyShareBigInt,
			this.nonceShare.k,
			this.nonceShare.gamma,
			messageHashBigInt,
			this.r,
			this.state.participatingParties,
		);

		await this.apiClient.submitPartialSignature(
			this.state.sessionId,
			this.keyShare.partyId,
			{
				r: this.r.toString(16).padStart(64, "0"),
				s: partial.sigma.toString(16).padStart(64, "0"),
				publicShare: partial.publicShare,
				nonceCommitment: partial.nonceCommitment,
			},
		);

		this.state.partialSignatures.set(this.keyShare.partyId, {
			partyId: this.keyShare.partyId,
			r: this.r.toString(16).padStart(64, "0"),
			s: partial.sigma.toString(16).padStart(64, "0"),
			publicShare: partial.publicShare,
			nonceCommitment: partial.nonceCommitment,
		});

		const otherPartials = await this.waitForPartialSignatures();
		await this.verifyOtherPartials(otherPartials, messageHashBigInt);

		this.state.round = "complete";
	}

	private async waitForPartialSignatures(): Promise<
		Map<number, PartialSignatureData>
	> {
		const startTime = Date.now();
		const partials = new Map<number, PartialSignatureData>();

		while (Date.now() - startTime < this.timeout) {
			const result = await this.apiClient.getPartialSignatures(
				this.state?.sessionId ?? "",
			);

			for (const p of result.partials) {
				if (p.partyId !== this.keyShare.partyId && !partials.has(p.partyId)) {
					let sigma: bigint;
					try {
						if (!/^[0-9a-fA-F]{1,64}$/.test(p.s)) {
							throw new SDKError(
								`Invalid sigma hex from party ${p.partyId}`,
								"INVALID_PARTIAL_FORMAT",
							);
						}
						sigma = BigInt(`0x${p.s}`);
					} catch (e) {
						if (e instanceof SDKError) throw e;
						throw new SDKError(
							`Failed to parse sigma from party ${p.partyId}`,
							"INVALID_PARTIAL_FORMAT",
						);
					}

					partials.set(p.partyId, {
						partyId: p.partyId,
						sigma,
						publicShare: p.publicShare,
						nonceCommitment: p.nonceCommitment,
					});
				}
			}

			const expectedCount = (this.state?.participatingParties.length ?? 1) - 1;
			if (result.ready || partials.size >= expectedCount) {
				return partials;
			}

			await this.delay(500);
		}

		throw new SDKError(
			"Timeout waiting for partial signatures",
			"PARTIAL_SIGNATURE_TIMEOUT",
		);
	}

	private async verifyOtherPartials(
		partials: Map<number, PartialSignatureData>,
		messageHash: bigint,
	): Promise<void> {
		for (const [partyId, partial] of partials) {
			const expectedNonceCommitment = this.receivedCommitments.get(partyId);
			if (!expectedNonceCommitment) {
				throw new SDKError(
					`Missing nonce commitment for party ${partyId}`,
					"MISSING_NONCE_COMMITMENT",
				);
			}

			const expectedPublicShare = this.expectedPublicShares.get(partyId);
			if (!expectedPublicShare) {
				throw new SDKError(
					`Missing expected public share for party ${partyId}. Public shares from DKG must be provided via partyPublicShares config.`,
					"MISSING_PUBLIC_SHARE",
				);
			}

			const isValid = verifyPartialSignature(
				partial,
				expectedPublicShare,
				expectedNonceCommitment.E,
				this.r!,
				messageHash,
				this.state?.participatingParties ?? [],
			);

			if (!isValid) {
				throw new SDKError(
					`Invalid partial signature from party ${partyId}`,
					"INVALID_PARTIAL_SIGNATURE",
				);
			}

			this.state?.partialSignatures.set(partyId, {
				partyId,
				r: this.r?.toString(16).padStart(64, "0") ?? "",
				s: partial.sigma.toString(16).padStart(64, "0"),
				publicShare: partial.publicShare,
				nonceCommitment: partial.nonceCommitment,
			});
		}
	}

	private async completeProtocol(): Promise<SigningResult> {
		if (!this.state || this.r === null) {
			throw new SDKError("Protocol not complete", "PROTOCOL_INCOMPLETE");
		}

		const result = await this.waitForSigningResult();

		if (!result.complete || !result.signature) {
			throw new SDKError("Signing not complete", "SIGNING_INCOMPLETE");
		}

		return {
			success: true,
			signature: result.signature,
		};
	}

	private async waitForNonceCommitments(): Promise<
		Map<number, NonceCommitment>
	> {
		const startTime = Date.now();
		const commitments = new Map<number, NonceCommitment>();

		while (Date.now() - startTime < this.timeout) {
			const result = await this.apiClient.getNonceCommitments(
				this.state?.sessionId ?? "",
			);

			for (const [partyIdStr, commitmentStr] of Object.entries(
				result.commitments,
			)) {
				const partyId = Number.parseInt(partyIdStr, 10);
				if (partyId !== this.keyShare.partyId && !commitments.has(partyId)) {
					commitments.set(partyId, JSON.parse(commitmentStr as string));
				}
			}

			if (result.ready) {
				return commitments;
			}

			const expectedCount = (this.state?.participatingParties.length ?? 1) - 1;
			if (commitments.size >= expectedCount) {
				return commitments;
			}

			await this.delay(500);
		}

		throw new SDKError(
			"Timeout waiting for nonce commitments",
			"NONCE_COMMITMENT_TIMEOUT",
		);
	}

	private async waitForSigningResult(): Promise<{
		complete: boolean;
		signature?: Signature;
	}> {
		const startTime = Date.now();

		while (Date.now() - startTime < this.timeout) {
			const result = await this.apiClient.getSigningResult(
				this.state?.sessionId ?? "",
			);

			if (result.complete && result.signature) {
				return result;
			}

			await this.delay(500);
		}

		throw new SDKError(
			"Timeout waiting for signing result",
			"SIGNING_RESULT_TIMEOUT",
		);
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private cleanup(): void {
		this.state = null;
		this.nonceShare = null;
		this.receivedCommitments.clear();
		this.expectedPublicShares.clear();
		this.r = null;
	}
}

export function createSigningClient(
	apiClient: APIClient,
	keyShare: KeyShare,
	partyPublicShares: Map<number, string>,
	wsClient?: WebSocketClient,
): SigningClient {
	return new SigningClient({
		apiClient,
		wsClient,
		keyShare,
		partyPublicShares,
	});
}
