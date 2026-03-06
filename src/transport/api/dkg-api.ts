import type { WalletInfo } from "../../types";
import type { RequestFn } from "./types";

export class DkgAPI {
	constructor(private request: RequestFn) {}

	async initiate(
		threshold?: number,
		totalParties?: number,
	): Promise<{
		sessionId: string;
		backendCommitment: {
			partyId: number;
			commitments: string[];
			publicKey: string;
			proofOfKnowledge: string;
		};
		ephemeralPublicKey: string;
		message: string;
	}> {
		return this.request("POST", "/api/v2/dkg/initiate", {
			threshold,
			totalParties,
		});
	}

	async submitCommitment(
		sessionId: string,
		clientCommitment: {
			partyId: number;
			commitments: string[];
			publicKey: string;
			proofOfKnowledge: string;
		},
	): Promise<{
		sessionId: string;
		backendShareForClient: {
			fromPartyId: number;
			toPartyId: number;
			ephemeralPublicKey: string;
			ciphertext: string;
			nonce: string;
			tag: string;
		};
		message: string;
	}> {
		return this.request("POST", "/api/v2/dkg/commitment", {
			sessionId,
			clientCommitment,
		});
	}

	async submitShare(
		sessionId: string,
		clientShare: {
			fromPartyId: number;
			toPartyId: number;
			ephemeralPublicKey: string;
			ciphertext: string;
			nonce: string;
			tag: string;
		},
	): Promise<{
		sessionId: string;
		publicKey: string;
		walletAddress: string;
		partyId: number;
		backendShare: string;
		message: string;
	}> {
		return this.request("POST", "/api/v2/dkg/share", {
			sessionId,
			clientShare,
		});
	}

	async getSession(sessionId: string): Promise<{
		sessionId: string;
		status: string;
		threshold: number;
		totalParties: number;
		result: {
			publicKey: string;
			walletAddress: string;
			partyId: number;
		} | null;
		error: string | null;
		createdAt: string;
		completedAt: string | null;
	}> {
		return this.request("GET", `/api/v2/dkg/${sessionId}`);
	}

	async cancel(sessionId: string): Promise<{
		sessionId: string;
		message: string;
	}> {
		return this.request("DELETE", `/api/v2/dkg/${sessionId}`);
	}

	/** @deprecated Legacy v1 DKG endpoints */
	async legacyInitiate(): Promise<{
		sessionId: string;
		partyId: number;
		participantCount: number;
		threshold: number;
	}> {
		return this.request("POST", "/api/mpc/dkg/initiate");
	}

	async legacySubmitCommitment(
		sessionId: string,
		commitment: {
			partyId: number;
			commitments: string[];
			publicKey: string;
			proofOfKnowledge: string;
		},
	): Promise<void> {
		return this.request("POST", "/api/mpc/dkg/commitment", {
			sessionId,
			commitment,
		});
	}

	async legacyGetCommitments(sessionId: string): Promise<{
		commitments: Array<{
			partyId: number;
			commitments: string[];
			publicKey: string;
			proofOfKnowledge?: string;
		}>;
		ready: boolean;
	}> {
		return this.request("GET", `/api/mpc/dkg/${sessionId}/commitments`);
	}

	async legacySubmitShare(
		sessionId: string,
		encryptedShare: string,
		toPartyId: number,
	): Promise<void> {
		return this.request("POST", "/api/mpc/dkg/share", {
			sessionId,
			encryptedShare,
			toPartyId,
		});
	}

	async legacyGetShares(
		sessionId: string,
		partyId: number,
	): Promise<{
		shares: Array<{
			fromPartyId: number;
			encryptedShare: string;
		}>;
		ready: boolean;
	}> {
		return this.request("GET", `/api/mpc/dkg/${sessionId}/shares/${partyId}`);
	}

	async legacyComplete(
		sessionId: string,
		partyId: number,
		publicKey: string,
		walletAddress: string,
	): Promise<{
		success: boolean;
		wallet: WalletInfo;
	}> {
		return this.request("POST", "/api/mpc/dkg/complete", {
			sessionId,
			partyId,
			publicKey,
			walletAddress,
		});
	}
}
