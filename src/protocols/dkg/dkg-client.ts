import { secp256k1 } from "@noble/curves/secp256k1";
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
	decryptShare,
	encryptShare,
	generateEphemeralKeyPair,
} from "./share-exchange";

const PROTOCOL_VERSION = "pedersen-dkg-v2";

export interface DKGClientConfig {
	apiClient: APIClient;
	wsClient?: WebSocketClient;
	timeout?: number;
}

export class DKGClient {
	private apiClient: APIClient;
	private state: DKGSessionState | null = null;

	private polynomial: bigint[] = [];
	private ephemeralKeyPair: { privateKey: bigint; publicKey: string } | null =
		null;
	private receivedCommitments: Map<number, VSSSCommitment> = new Map();
	private receivedShares: Map<number, bigint> = new Map();

	constructor(config: DKGClientConfig) {
		this.apiClient = config.apiClient;
	}

	async execute(): Promise<DKGResult> {
		try {
			// Step 1: Initiate — receive backend commitment + ephemeral key
			const initResult = await this.apiClient.dkgInitiate();
			const { sessionId, backendCommitment, ephemeralPublicKey } = initResult;

			const threshold = 2;
			const participantCount = 2;
			const partyId = 1;

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

			// Verify backend's proof of knowledge
			if (
				!verifyProofOfKnowledge(
					backendCommitment.proofOfKnowledge,
					backendCommitment.partyId,
					backendCommitment.commitments[0],
				)
			) {
				throw new SDKError(
					"Invalid proof of knowledge from backend",
					"INVALID_COMMITMENT_PROOF",
				);
			}

			this.receivedCommitments.set(backendCommitment.partyId, {
				partyId: backendCommitment.partyId,
				coefficientCommitments: backendCommitment.commitments,
				proofOfKnowledge: backendCommitment.proofOfKnowledge,
			});

			// Step 2: Submit client commitment — receive backend's encrypted share
			const clientCommitment = createVSSSCommitments(partyId, this.polynomial);
			this.receivedCommitments.set(partyId, clientCommitment);

			const commitResult = await this.apiClient.dkgSubmitCommitment(sessionId, {
				partyId,
				commitments: clientCommitment.coefficientCommitments,
				publicKey: this.ephemeralKeyPair.publicKey,
				proofOfKnowledge: clientCommitment.proofOfKnowledge,
			});

			// Decrypt backend's share
			const backendShare = commitResult.backendShareForClient;
			const decrypted = await decryptShare(
				{
					fromPartyId: backendShare.fromPartyId,
					toPartyId: backendShare.toPartyId,
					ephemeralPublicKey: backendShare.ephemeralPublicKey,
					ciphertext: backendShare.ciphertext,
					nonce: backendShare.nonce,
					tag: backendShare.tag,
				},
				this.ephemeralKeyPair.privateKey,
			);

			const backendVsss = this.receivedCommitments.get(
				backendCommitment.partyId,
			);
			if (
				backendVsss &&
				!verifyVSSSCommitment(backendVsss, decrypted.share, partyId)
			) {
				throw new SDKError("Invalid share from backend", "INVALID_SHARE");
			}

			this.receivedShares.set(backendCommitment.partyId, decrypted.share);

			// Evaluate own share and aggregate
			const ownShare = evaluatePolynomial(this.polynomial, BigInt(partyId));
			this.receivedShares.set(partyId, ownShare);

			// Step 3: Encrypt client's share for backend and submit
			const shareForBackend = evaluatePolynomial(
				this.polynomial,
				BigInt(backendCommitment.partyId),
			);
			const encrypted = await encryptShare(
				shareForBackend,
				partyId,
				backendCommitment.partyId,
				ephemeralPublicKey,
			);

			const shareResult = await this.apiClient.dkgSubmitShare(sessionId, {
				fromPartyId: partyId,
				toPartyId: backendCommitment.partyId,
				ephemeralPublicKey: encrypted.ephemeralPublicKey,
				ciphertext: encrypted.ciphertext,
				nonce: encrypted.nonce,
				tag: encrypted.tag,
			});

			// Finalize: compute final share and public key
			const finalShare = aggregateShares(this.receivedShares, 0n);
			const allCommitments = Array.from(this.receivedCommitments.values());
			const publicKey = combineVSSSCommitments(allCommitments);

			this.state.privateShare = finalShare;
			this.state.publicKey = publicKey;
			this.state.backendShare = shareResult.backendShare;
			this.state.round = "complete";

			return {
				success: true,
				publicKey,
				walletAddress: shareResult.walletAddress,
				partyId,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : "DKG failed";
			return {
				success: false,
				error: message,
			};
		}
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

	getBackendShare(): string | null {
		return this.state?.backendShare ?? null;
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

	private computeShareCommitment(share: bigint): string {
		const shareHex = scalarToHex(share);
		return bytesToHex(sha256(hexToBytes(shareHex)));
	}

	cleanup(): void {
		this.state = null;
		this.polynomial = [];
		this.ephemeralKeyPair = null;
		this.receivedCommitments.clear();
		this.receivedShares.clear();
	}
}
