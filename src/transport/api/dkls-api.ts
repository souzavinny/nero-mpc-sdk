import type { RequestFn } from "./types";

export class DklsAPI {
	constructor(private request: RequestFn) {}

	async keygenInit(): Promise<{
		sessionId: string;
		backendCommitment: {
			partyId: number;
			commitment: string;
		};
	}> {
		return this.request("POST", "/api/v2/dkls/keygen/init");
	}

	async keygenCommitment(
		sessionId: string,
		clientCommitment: {
			partyId: number;
			commitment: string;
		},
	): Promise<{
		sessionId: string;
		backendPublicShare: {
			partyId: number;
			publicShare: string;
			proof: {
				commitment: string;
				challenge: string;
				response: string;
			};
		};
	}> {
		return this.request("POST", "/api/v2/dkls/keygen/commitment", {
			sessionId,
			clientCommitment,
		});
	}

	async keygenComplete(
		sessionId: string,
		clientPublicShare: {
			partyId: number;
			publicShare: string;
			proof: {
				commitment: string;
				challenge: string;
				response: string;
			};
		},
	): Promise<{
		sessionId: string;
		walletAddress: string;
		jointPublicKey: string;
		keyId: string;
	}> {
		return this.request("POST", "/api/v2/dkls/keygen/complete", {
			sessionId,
			clientPublicShare,
		});
	}

	async signingInit(params: {
		messageHash: string;
		messageType?: "message" | "transaction" | "typed_data";
		dkgSessionId: string;
	}): Promise<{
		sessionId: string;
		status: string;
		backendNonceCommitment: {
			partyId: number;
			commitment: string;
		};
		walletAddress: string;
	}> {
		return this.request("POST", "/api/v2/dkls/signing/init", params);
	}

	async signingNonce(
		sessionId: string,
		clientNonceCommitment: {
			partyId: number;
			R: string;
			commitment: string;
		},
	): Promise<{
		sessionId: string;
		r: string;
		rValue: string;
		backendNonceReveal: {
			partyId: number;
			R: string;
		};
		backendPartialSignature: {
			partyId: number;
			sigma: string;
			R: string;
		};
	}> {
		return this.request("POST", "/api/v2/dkls/signing/nonce", {
			sessionId,
			clientNonceCommitment,
		});
	}

	/**
	 * @deprecated This method defeats threshold security by transmitting the full key share.
	 * Use the MtA-based signing flow instead: mtaRound1 -> mtaRound2 -> signingPartial.
	 * This endpoint is only available in test mode (DKLS_LOCAL_TESTING_MODE=true).
	 */
	async signingComplete(
		sessionId: string,
		clientKeyShare: {
			partyId: number;
			secretShare: string;
			publicShare: string;
			jointPublicKey: string;
		},
	): Promise<{
		sessionId: string;
		signature: string;
		r: string;
		s: string;
		v: number;
		messageHash: string;
		walletAddress: string | null;
		securityLevel: string;
	}> {
		console.warn(
			"[DEPRECATED] dklsSigningComplete defeats threshold security. " +
				"Use MtA-based signing (mtaRound1/mtaRound2/signingPartial) instead.",
		);
		return this.request("POST", "/api/v2/dkls/signing/complete", {
			sessionId,
			clientKeyShare,
		});
	}

	async signingStatus(sessionId: string): Promise<{
		sessionId: string;
		status: string;
		messageHash: string;
		messageType: string;
		result?: {
			signature: string;
			r: string;
			s: string;
			v: number;
		};
		error?: string;
		createdAt: string;
		completedAt?: string;
	}> {
		return this.request("GET", `/api/v2/dkls/signing/${sessionId}`);
	}

	async signingCancel(sessionId: string): Promise<{
		sessionId: string;
		message: string;
	}> {
		return this.request("DELETE", `/api/v2/dkls/signing/${sessionId}`);
	}

	async mtaRound1(
		sessionId: string,
		mta1Setup: {
			sessionId: string;
			setup: {
				setups: Array<{ A: string }>;
			};
		},
		mta2Setup: {
			sessionId: string;
			setup: {
				setups: Array<{ A: string }>;
			};
		},
	): Promise<{
		mta1Response: {
			sessionId: string;
			response: {
				responses: Array<{ B: string }>;
			};
		};
		mta2Response: {
			sessionId: string;
			response: {
				responses: Array<{ B: string }>;
			};
		};
	}> {
		return this.request("POST", "/api/v2/dkls/signing/mta/round1", {
			sessionId,
			mta1Setup,
			mta2Setup,
		});
	}

	async mtaRound2(
		sessionId: string,
		mta1Encrypted: {
			sessionId: string;
			encrypted: {
				encrypted: Array<{ e0: string; e1: string }>;
			};
		},
		mta2Encrypted: {
			sessionId: string;
			encrypted: {
				encrypted: Array<{ e0: string; e1: string }>;
			};
		},
	): Promise<{
		success: true;
	}> {
		return this.request("POST", "/api/v2/dkls/signing/mta/round2", {
			sessionId,
			mta1Encrypted,
			mta2Encrypted,
		});
	}

	async signingPartial(
		sessionId: string,
		clientPartialSignature: {
			partyId: number;
			s: string;
		},
	): Promise<{
		signature: string;
		r: string;
		s: string;
		v: number;
	}> {
		return this.request("POST", "/api/v2/dkls/signing/partial", {
			sessionId,
			clientPartialSignature,
		});
	}
}
