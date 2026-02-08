/**
 * DKLS SDK Types
 *
 * Type definitions for DKLS threshold ECDSA protocol.
 * Multiplicative secret sharing: sk = sk_A × sk_B (mod q)
 */

export interface DKLSKeyShare {
	partyId: number;
	secretShare: string;
	publicShare: string;
	jointPublicKey: string;
}

export interface DKLSSchnorrProof {
	commitment: string;
	challenge: string;
	response: string;
}

export interface DKLSKeygenCommitment {
	partyId: number;
	commitment: string;
}

export interface DKLSKeygenPublicShare {
	partyId: number;
	publicShare: string;
	proof: DKLSSchnorrProof;
}

export interface DKLSNonceCommitment {
	partyId: number;
	R: string;
	commitment: string;
}

export interface DKLSSigningResult {
	signature: string;
	r: string;
	s: string;
	v: number;
	messageHash: string;
	walletAddress?: string | null;
}

export interface DKLSKeygenSessionState {
	sessionId: string;
	status:
		| "initialized"
		| "commitment_sent"
		| "commitment_received"
		| "complete";
	backendCommitment?: DKLSKeygenCommitment;
	backendPublicShare?: DKLSKeygenPublicShare;
	clientKeyShare?: DKLSKeyShare;
}

export interface DKLSSigningSessionState {
	sessionId: string;
	status:
		| "initialized"
		| "nonce_committed"
		| "nonce_exchanged"
		| "mta_round1_complete"
		| "mta_round2_complete"
		| "partial_computed"
		| "completed"
		| "failed";
	messageHash: string;
	messageType: "message" | "transaction" | "typed_data";
	backendNonceCommitment?: DKLSNonceCommitment;
	r?: string;
	rValue?: string;
	result?: DKLSSigningResult;
	error?: string;
}

export interface DKLSSignRequest {
	messageHash: string;
	messageType?: "message" | "transaction" | "typed_data";
	dkgSessionId: string;
}

export interface DKLSMtaRound1Request {
	sessionId: string;
	mta1Setup: {
		sessionId: string;
		setup: {
			setups: Array<{ A: string }>;
		};
	};
	mta2Setup: {
		sessionId: string;
		setup: {
			setups: Array<{ A: string }>;
		};
	};
}

export interface DKLSMtaRound1Response {
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
}

export interface DKLSMtaRound2Request {
	sessionId: string;
	mta1Encrypted: {
		sessionId: string;
		encrypted: {
			encrypted: Array<{ e0: string; e1: string }>;
		};
	};
	mta2Encrypted: {
		sessionId: string;
		encrypted: {
			encrypted: Array<{ e0: string; e1: string }>;
		};
	};
}

export interface DKLSMtaRound2Response {
	success: true;
}

export interface DKLSPartialSignatureRequest {
	sessionId: string;
	clientPartialSignature: {
		partyId: number;
		s: string;
	};
}

export interface DKLSPartialSignatureResponse {
	signature: string;
	r: string;
	s: string;
	v: number;
}
