export { DKGClient, type DKGClientConfig } from "./dkg-client";

export {
	generatePolynomial,
	evaluatePolynomial,
	computeCommitments,
	verifyShareAgainstCommitments,
	combinePublicKeys,
	computeLagrangeCoefficient,
	aggregateShares,
	scalarToHex,
	hexToScalar,
	CURVE_ORDER,
} from "./polynomial";

export {
	createPedersenCommitment,
	verifyPedersenCommitment,
	createVSSSCommitments,
	verifyVSSSCommitment,
	verifyProofOfKnowledge,
	combineVSSSCommitments,
	type PedersenCommitment,
	type VSSSCommitment,
} from "./commitments";

export {
	encryptShare,
	decryptShare,
	generateEphemeralKeyPair,
	serializeEncryptedShare,
	deserializeEncryptedShare,
	type EncryptedShare,
	type DecryptedShare,
} from "./share-exchange";
