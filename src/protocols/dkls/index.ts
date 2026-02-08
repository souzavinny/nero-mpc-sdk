export {
	DKLSClient,
	createDKLSClient,
	type DKLSClientConfig,
} from "./dkls-client";

export {
	keygenInitClient,
	keygenProcessBackendCommitment,
	keygenGenerateReveal,
	keygenComplete,
	signingInit,
	signingProcessBackendNonce,
	generateSchnorrProof,
	deriveEthereumAddress,
	serializeKeyShare,
	type DKLSKeygenClientState,
	type DKLSSigningClientState,
} from "./crypto";

export type {
	DKLSKeyShare,
	DKLSSchnorrProof,
	DKLSKeygenCommitment,
	DKLSKeygenPublicShare,
	DKLSNonceCommitment,
	DKLSSigningResult,
	DKLSKeygenSessionState,
	DKLSSigningSessionState,
	DKLSSignRequest,
} from "./types";
