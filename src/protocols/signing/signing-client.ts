import type { APIClient } from "../../transport/api-client";
import type {
	KeyShare,
	SigningRequest,
	SigningResult,
} from "../../types";
import { SDKError } from "../../types";
import {
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
	keyShare: KeyShare;
	partyPublicShares: Map<number, string>;
}

export class SigningClient {
	private apiClient: APIClient;
	private keyShare: KeyShare;
	private expectedPublicShares: Map<number, string>;

	constructor(config: SigningClientConfig) {
		this.apiClient = config.apiClient;
		this.keyShare = config.keyShare;
		this.expectedPublicShares = new Map(config.partyPublicShares);
	}

	async sign(request: SigningRequest): Promise<SigningResult> {
		try {
			// Step 1: Initiate — get backend nonce commitment
			const initResult = await this.apiClient.signingInit(
				request.messageHash,
				request.messageType,
			);

			const { sessionId, backendNonceCommitment } = initResult;

			// Verify backend's nonce commitment
			if (!verifyNonceCommitment(backendNonceCommitment)) {
				throw new SDKError(
					"Invalid nonce commitment from backend",
					"INVALID_NONCE_COMMITMENT",
				);
			}
			if (!verifyNonceProof(backendNonceCommitment)) {
				throw new SDKError(
					"Invalid nonce proof from backend",
					"INVALID_NONCE_PROOF",
				);
			}

			// Generate client nonce and commitment
			const nonceShare: NonceShare = generateNonceShare();
			const clientCommitment = createNonceCommitment(
				this.keyShare.partyId,
				nonceShare,
			);

			// Combine nonce commitments to compute R
			const allCommitments = [clientCommitment, backendNonceCommitment];
			const { R } = combineNonceCommitments(allCommitments);
			const { r } = computeR(R);

			// Step 2: Submit client nonce — get backend partial signature
			const nonceResult = await this.apiClient.signingNonce(
				sessionId,
				clientCommitment,
			);

			const backendPartial = nonceResult.backendPartialSignature;

			// Verify backend's partial signature
			const backendPublicShare = this.expectedPublicShares.get(
				backendPartial.partyId,
			);
			if (backendPublicShare) {
				const backendCommitment = backendNonceCommitment;
				const messageHashBigInt = parseMessageHash(request.messageHash);

				const partialData: PartialSignatureData = {
					partyId: backendPartial.partyId,
					sigma: BigInt(`0x${backendPartial.sigma}`),
					publicShare: backendPartial.publicShare,
					nonceCommitment: backendPartial.nonceCommitment,
				};

				const isValid = verifyPartialSignature(
					partialData,
					backendPublicShare,
					backendCommitment.E,
					r,
					messageHashBigInt,
					[
						this.keyShare.partyId,
						backendNonceCommitment.partyId,
					],
				);

				if (!isValid) {
					throw new SDKError(
						"Invalid partial signature from backend",
						"INVALID_PARTIAL_SIGNATURE",
					);
				}
			}

			// Compute client's partial signature
			const messageHashBigInt = parseMessageHash(request.messageHash);
			const keyShareBigInt = BigInt(`0x${this.keyShare.privateShare}`);

			const partial = computePartialSignature(
				this.keyShare.partyId,
				keyShareBigInt,
				nonceShare.k,
				nonceShare.gamma,
				messageHashBigInt,
				r,
				[this.keyShare.partyId, backendNonceCommitment.partyId],
			);

			// Step 3: Submit client partial — get final signature
			const completeResult = await this.apiClient.signingComplete(
				sessionId,
				{
					partyId: this.keyShare.partyId,
					sigma: partial.sigma.toString(16).padStart(64, "0"),
					publicShare: partial.publicShare,
					nonceCommitment: partial.nonceCommitment,
				},
			);

			return {
				success: true,
				signature: {
					r: completeResult.r,
					s: completeResult.s,
					v: completeResult.v,
					fullSignature: completeResult.signature,
				},
			};
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Signing failed";
			return {
				success: false,
				error: message,
			};
		}
	}
}

export function createSigningClient(
	apiClient: APIClient,
	keyShare: KeyShare,
	partyPublicShares: Map<number, string>,
): SigningClient {
	return new SigningClient({
		apiClient,
		keyShare,
		partyPublicShares,
	});
}
