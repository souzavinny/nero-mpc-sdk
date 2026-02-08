import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import type { APIClient } from "../../transport/api-client";
import type { WebSocketClient } from "../../transport/websocket-client";
import type { DKGResult, DKGSessionState, KeyShare } from "../../types";
import { SDKError } from "../../types";
import {
	type VSSSCommitment,
	combineVSSSCommitments,
	createVSSSCommitments,
	verifyProofOfKnowledge,
	verifyVSSSCommitment,
} from "./commitments";
import {
	aggregateShares,
	evaluatePolynomial,
	generatePolynomial,
	scalarToHex,
} from "./polynomial";
import {
	type EncryptedShare,
	decryptShare,
	encryptShare,
	generateEphemeralKeyPair,
} from "./share-exchange";

const PROTOCOL_VERSION = "pedersen-dkg-v1";

export interface DKGClientConfig {
	apiClient: APIClient;
	wsClient?: WebSocketClient;
	timeout?: number;
}

export class DKGClient {
	private apiClient: APIClient;
	private wsClient?: WebSocketClient;
	private timeout: number;
	private state: DKGSessionState | null = null;

	private polynomial: bigint[] = [];
	private ephemeralKeyPair: { privateKey: bigint; publicKey: string } | null =
		null;
	private receivedCommitments: Map<number, VSSSCommitment> = new Map();
	private receivedShares: Map<number, bigint> = new Map();

	constructor(config: DKGClientConfig) {
		this.apiClient = config.apiClient;
		this.wsClient = config.wsClient;
		this.timeout = config.timeout ?? 60000;
	}

	async execute(): Promise<DKGResult> {
		try {
			await this.initializeSession();

			await this.runCommitmentPhase();

			await this.runShareExchangePhase();

			await this.runVerificationPhase();

			return await this.completeProtocol();
		} catch (error) {
			const message = error instanceof Error ? error.message : "DKG failed";
			return {
				success: false,
				error: message,
			};
		}
	}

	private async initializeSession(): Promise<void> {
		const { sessionId, partyId, participantCount, threshold } =
			await this.apiClient.initiateDKG();

		if (threshold < 2) {
			throw new SDKError(
				"Threshold must be at least 2 for security",
				"INVALID_THRESHOLD",
			);
		}
		if (participantCount < 2) {
			throw new SDKError(
				"Participant count must be at least 2",
				"INVALID_PARTICIPANT_COUNT",
			);
		}
		if (threshold > participantCount) {
			throw new SDKError(
				"Threshold cannot exceed participant count",
				"INVALID_THRESHOLD",
			);
		}

		this.state = {
			sessionId,
			round: "commitment",
			partyId,
			participantCount,
			threshold,
			commitments: new Map(),
			receivedShares: new Map(),
		};

		this.polynomial = generatePolynomial(threshold - 1);

		this.ephemeralKeyPair = generateEphemeralKeyPair();

		if (this.wsClient) {
			await this.wsClient.connect();
			this.wsClient.setAccessToken(
				this.apiClient.getTokens()?.accessToken ?? "",
			);
		}
	}

	private async runCommitmentPhase(): Promise<void> {
		if (!this.state) throw new SDKError("State not initialized", "STATE_ERROR");

		const commitment = createVSSSCommitments(
			this.state.partyId,
			this.polynomial,
		);

		const apiCommitment = {
			partyId: this.state.partyId,
			commitments: commitment.coefficientCommitments,
			publicKey: this.ephemeralKeyPair?.publicKey ?? "",
			proofOfKnowledge: commitment.proofOfKnowledge,
		};

		await this.apiClient.submitDKGCommitment(
			this.state.sessionId,
			apiCommitment,
		);

		this.receivedCommitments.set(this.state.partyId, commitment);

		const otherCommitments = await this.waitForCommitments();

		for (const [partyId, comm] of otherCommitments) {
			if (!comm.proofOfKnowledge) {
				throw new SDKError(
					`Missing proof of knowledge from party ${comm.partyId}. Backend must relay proofs for client-side verification.`,
					"MISSING_COMMITMENT_PROOF",
				);
			}
			if (comm.partyId !== partyId) {
				throw new SDKError(
					`Party ID mismatch: expected ${partyId}, got ${comm.partyId}`,
					"PARTY_ID_MISMATCH",
				);
			}
			if (
				!verifyProofOfKnowledge(
					comm.proofOfKnowledge,
					comm.partyId,
					comm.coefficientCommitments[0],
				)
			) {
				throw new SDKError(
					`Invalid proof of knowledge from party ${comm.partyId}`,
					"INVALID_COMMITMENT_PROOF",
				);
			}
			this.receivedCommitments.set(comm.partyId, comm);
		}

		this.state.round = "share_exchange";
	}

	private async runShareExchangePhase(): Promise<void> {
		if (!this.state) throw new SDKError("State not initialized", "STATE_ERROR");

		for (let partyId = 1; partyId <= this.state.participantCount; partyId++) {
			if (partyId === this.state.partyId) continue;

			const share = evaluatePolynomial(this.polynomial, BigInt(partyId));

			const commitment = this.receivedCommitments.get(partyId);
			if (!commitment) {
				throw new SDKError(
					`Missing commitment from party ${partyId}`,
					"MISSING_COMMITMENT",
				);
			}

			const apiCommitment = await this.apiClient.getDKGCommitments(
				this.state.sessionId,
			);
			const partyCommitment = apiCommitment.commitments.find(
				(c) => c.partyId === partyId,
			);
			if (!partyCommitment) {
				throw new SDKError(
					`Missing public key from party ${partyId}`,
					"MISSING_PUBLIC_KEY",
				);
			}

			const encrypted = await encryptShare(
				share,
				this.state.partyId,
				partyId,
				partyCommitment.publicKey,
			);

			await this.apiClient.submitDKGShare(
				this.state.sessionId,
				JSON.stringify(encrypted),
				partyId,
			);
		}

		const ownShare = evaluatePolynomial(
			this.polynomial,
			BigInt(this.state.partyId),
		);
		this.receivedShares.set(this.state.partyId, ownShare);

		const receivedShares = await this.waitForShares();

		for (const [partyId, encryptedShare] of receivedShares) {
			const decrypted = await decryptShare(
				encryptedShare,
				this.ephemeralKeyPair?.privateKey ?? 0n,
			);

			const commitment = this.receivedCommitments.get(partyId);
			if (!commitment) {
				throw new SDKError(
					`Missing commitment from party ${partyId}`,
					"MISSING_COMMITMENT",
				);
			}

			if (
				!verifyVSSSCommitment(commitment, decrypted.share, this.state.partyId)
			) {
				throw new SDKError(
					`Invalid share from party ${partyId}`,
					"INVALID_SHARE",
				);
			}

			this.receivedShares.set(partyId, decrypted.share);
		}

		this.state.round = "verification";
	}

	private async runVerificationPhase(): Promise<void> {
		if (!this.state) throw new SDKError("State not initialized", "STATE_ERROR");

		const finalShare = aggregateShares(this.receivedShares, 0n);

		const allCommitments = Array.from(this.receivedCommitments.values());
		const publicKey = combineVSSSCommitments(allCommitments);

		this.state.privateShare = finalShare;
		this.state.publicKey = publicKey;
		this.state.round = "complete";
	}

	private async completeProtocol(): Promise<DKGResult> {
		if (!this.state || !this.state.privateShare || !this.state.publicKey) {
			throw new SDKError("Protocol not complete", "PROTOCOL_INCOMPLETE");
		}

		const walletAddress = this.deriveWalletAddress(this.state.publicKey);

		await this.apiClient.completeDKG(
			this.state.sessionId,
			this.state.partyId,
			this.state.publicKey,
			walletAddress,
		);

		return {
			success: true,
			publicKey: this.state.publicKey,
			walletAddress,
			partyId: this.state.partyId,
		};
	}

	getKeyShare(): KeyShare | null {
		if (!this.state?.privateShare) return null;

		return {
			partyId: this.state.partyId,
			privateShare: scalarToHex(this.state.privateShare),
			publicShare: secp256k1.ProjectivePoint.BASE.multiply(
				this.state.privateShare,
			).toHex(true),
			commitment: this.computeShareCommitment(this.state.privateShare),
			threshold: this.state.threshold,
			totalParties: this.state.participantCount,
			protocolVersion: PROTOCOL_VERSION,
		};
	}

	getPartyPublicShares(): Map<number, string> {
		const shares = new Map<number, string>();

		for (const [partyId, commitment] of this.receivedCommitments) {
			if (commitment.coefficientCommitments.length > 0) {
				shares.set(partyId, commitment.coefficientCommitments[0]);
			}
		}

		return shares;
	}

	private async waitForCommitments(): Promise<Map<number, VSSSCommitment>> {
		const startTime = Date.now();
		const commitments = new Map<number, VSSSCommitment>();

		while (Date.now() - startTime < this.timeout) {
			const result = await this.apiClient.getDKGCommitments(
				this.state?.sessionId ?? "",
			);

			for (const comm of result.commitments) {
				if (
					comm.partyId !== this.state?.partyId &&
					!commitments.has(comm.partyId)
				) {
					commitments.set(comm.partyId, {
						partyId: comm.partyId,
						coefficientCommitments: comm.commitments,
						proofOfKnowledge: comm.proofOfKnowledge ?? "",
					});
				}
			}

			if (
				result.ready ||
				commitments.size >= (this.state?.participantCount ?? 1) - 1
			) {
				return commitments;
			}

			await this.delay(1000);
		}

		throw new SDKError("Timeout waiting for commitments", "COMMITMENT_TIMEOUT");
	}

	private async waitForShares(): Promise<Map<number, EncryptedShare>> {
		const startTime = Date.now();
		const shares = new Map<number, EncryptedShare>();

		while (Date.now() - startTime < this.timeout) {
			const result = await this.apiClient.getDKGShares(
				this.state?.sessionId ?? "",
				this.state?.partyId ?? 0,
			);

			for (const share of result.shares) {
				if (!shares.has(share.fromPartyId)) {
					shares.set(share.fromPartyId, JSON.parse(share.encryptedShare));
				}
			}

			if (
				result.ready ||
				shares.size >= (this.state?.participantCount ?? 1) - 1
			) {
				return shares;
			}

			await this.delay(1000);
		}

		throw new SDKError("Timeout waiting for shares", "SHARE_TIMEOUT");
	}

	private deriveWalletAddress(publicKey: string): string {
		const pubKeyBytes = hexToBytes(
			publicKey.startsWith("04") ? publicKey.slice(2) : publicKey,
		);
		const hash = keccak_256(pubKeyBytes);
		const addressBytes = hash.slice(-20);
		return `0x${bytesToHex(addressBytes)}`;
	}

	private computeShareCommitment(share: bigint): string {
		const shareHex = scalarToHex(share);
		return bytesToHex(sha256(hexToBytes(shareHex)));
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	cleanup(): void {
		this.state = null;
		this.polynomial = [];
		this.ephemeralKeyPair = null;
		this.receivedCommitments.clear();
		this.receivedShares.clear();
	}
}
