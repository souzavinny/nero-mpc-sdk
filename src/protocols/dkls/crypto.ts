/**
 * DKLS Client-Side Cryptographic Primitives
 *
 * Implements the client-side key generation and signing primitives
 * for DKLS threshold ECDSA using multiplicative secret sharing.
 */

import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import type {
	DKLSKeyShare,
	DKLSKeygenCommitment,
	DKLSKeygenPublicShare,
	DKLSNonceCommitment,
	DKLSSchnorrProof,
} from "./types";

const CURVE_ORDER = secp256k1.CURVE.n;
const G = secp256k1.ProjectivePoint.BASE;

type Point = ReturnType<typeof secp256k1.ProjectivePoint.fromHex>;

function mod(n: bigint, m: bigint = CURVE_ORDER): bigint {
	const result = n % m;
	return result < 0n ? result + m : result;
}

function randomScalar(): bigint {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	let result = 0n;
	for (const byte of bytes) {
		result = (result << 8n) + BigInt(byte);
	}
	const scalar = mod(result);
	if (scalar === 0n) {
		return randomScalar();
	}
	return scalar;
}

function commitToPoint(point: Point): Uint8Array {
	return sha256(point.toRawBytes(true));
}

export interface DKLSKeygenClientState {
	partyId: number;
	secretShare: bigint;
	publicShare: Point;
	commitment: Uint8Array;
	peerCommitment: Uint8Array | null;
	peerPublicShare: Point | null;
	jointPublicKey: Point | null;
}

export function keygenInitClient(): {
	state: DKLSKeygenClientState;
	commitment: DKLSKeygenCommitment;
} {
	const secretShare = randomScalar();
	const publicShare = G.multiply(secretShare);
	const commitment = commitToPoint(publicShare);

	return {
		state: {
			partyId: 1,
			secretShare,
			publicShare,
			commitment,
			peerCommitment: null,
			peerPublicShare: null,
			jointPublicKey: null,
		},
		commitment: {
			partyId: 1,
			commitment: bytesToHex(commitment),
		},
	};
}

export function keygenProcessBackendCommitment(
	state: DKLSKeygenClientState,
	backendCommitment: DKLSKeygenCommitment,
): DKLSKeygenClientState {
	if (backendCommitment.partyId === state.partyId) {
		throw new Error("Cannot process own commitment");
	}

	return {
		...state,
		peerCommitment: hexToBytes(backendCommitment.commitment),
	};
}

export function generateSchnorrProof(
	secretKey: bigint,
	publicKey: Point,
): DKLSSchnorrProof {
	const k = randomScalar();
	const R = G.multiply(k);

	const challengeInput = new Uint8Array([
		...R.toRawBytes(true),
		...publicKey.toRawBytes(true),
		...G.toRawBytes(true),
	]);
	const challengeHash = sha256(challengeInput);
	const challenge = mod(BigInt(`0x${bytesToHex(challengeHash)}`));

	const response = mod(k + challenge * secretKey);

	return {
		commitment: R.toHex(true),
		challenge: challenge.toString(16).padStart(64, "0"),
		response: response.toString(16).padStart(64, "0"),
	};
}

export function keygenGenerateReveal(
	state: DKLSKeygenClientState,
): DKLSKeygenPublicShare {
	if (!state.peerCommitment) {
		throw new Error("Must receive peer commitment before generating reveal");
	}

	const proof = generateSchnorrProof(state.secretShare, state.publicShare);

	return {
		partyId: state.partyId,
		publicShare: state.publicShare.toHex(true),
		proof,
	};
}

function verifyCommitment(commitment: Uint8Array, point: Point): boolean {
	const expected = commitToPoint(point);
	if (expected.length !== commitment.length) return false;
	for (let i = 0; i < expected.length; i++) {
		if (expected[i] !== commitment[i]) return false;
	}
	return true;
}

function verifySchnorrProof(
	publicKey: Point,
	proof: DKLSSchnorrProof,
): boolean {
	try {
		const R = secp256k1.ProjectivePoint.fromHex(proof.commitment);
		const challenge = BigInt(`0x${proof.challenge}`);
		const response = BigInt(`0x${proof.response}`);

		const challengeInput = new Uint8Array([
			...R.toRawBytes(true),
			...publicKey.toRawBytes(true),
			...G.toRawBytes(true),
		]);
		const challengeHash = sha256(challengeInput);
		const expectedChallenge = mod(BigInt(`0x${bytesToHex(challengeHash)}`));

		if (challenge !== expectedChallenge) {
			return false;
		}

		const lhs = G.multiply(response);
		const rhs = R.add(publicKey.multiply(challenge));

		return lhs.equals(rhs);
	} catch {
		return false;
	}
}

export function keygenComplete(
	state: DKLSKeygenClientState,
	backendPublicShare: DKLSKeygenPublicShare,
): DKLSKeyShare {
	if (!state.peerCommitment) {
		throw new Error("Missing peer commitment");
	}

	const peerPublicKey = secp256k1.ProjectivePoint.fromHex(
		backendPublicShare.publicShare,
	);

	if (!verifyCommitment(state.peerCommitment, peerPublicKey)) {
		throw new Error("Backend public share does not match commitment");
	}

	if (!verifySchnorrProof(peerPublicKey, backendPublicShare.proof)) {
		throw new Error("Invalid Schnorr proof from backend");
	}

	const jointPublicKey = peerPublicKey.multiply(state.secretShare);

	return {
		partyId: state.partyId,
		secretShare: state.secretShare.toString(16).padStart(64, "0"),
		publicShare: state.publicShare.toHex(true),
		jointPublicKey: jointPublicKey.toHex(true),
	};
}

export interface DKLSSigningClientState {
	partyId: number;
	keyShare: DKLSKeyShare;
	messageHash: bigint;
	messageHashBytes: Uint8Array;
	nonceShare: bigint;
	noncePublic: Point;
	nonceCommitment: Uint8Array;
	peerNonceCommitment: Uint8Array | null;
	peerNoncePublic: Point | null;
	combinedNonce: Point | null;
	rValue: bigint | null;
}

export function signingInit(
	keyShare: DKLSKeyShare,
	messageHash: string,
): {
	state: DKLSSigningClientState;
	nonceCommitment: DKLSNonceCommitment;
} {
	const messageHashHex = messageHash.replace("0x", "");
	const messageHashBytes = hexToBytes(messageHashHex);
	const messageHashBigInt = BigInt(`0x${messageHashHex}`);

	const nonceShare = randomScalar();
	const noncePublic = G.multiply(nonceShare);
	const nonceCommitment = commitToPoint(noncePublic);

	return {
		state: {
			partyId: keyShare.partyId,
			keyShare,
			messageHash: messageHashBigInt,
			messageHashBytes,
			nonceShare,
			noncePublic,
			nonceCommitment,
			peerNonceCommitment: null,
			peerNoncePublic: null,
			combinedNonce: null,
			rValue: null,
		},
		nonceCommitment: {
			partyId: keyShare.partyId,
			R: noncePublic.toHex(true),
			commitment: bytesToHex(nonceCommitment),
		},
	};
}

export function signingStoreBackendCommitment(
	state: DKLSSigningClientState,
	backendCommitment: { partyId: number; commitment: string },
): DKLSSigningClientState {
	const peerNonceCommitment = hexToBytes(backendCommitment.commitment);
	return {
		...state,
		peerNonceCommitment,
	};
}

export function signingProcessBackendNonce(
	state: DKLSSigningClientState,
	backendNonceReveal: { partyId: number; R: string },
): DKLSSigningClientState {
	if (!state.peerNonceCommitment) {
		throw new Error("Must store backend commitment before processing reveal");
	}

	const peerNoncePublic = secp256k1.ProjectivePoint.fromHex(
		backendNonceReveal.R,
	);

	if (!verifyCommitment(state.peerNonceCommitment, peerNoncePublic)) {
		throw new Error("Backend nonce does not match commitment");
	}

	const combinedNonce = peerNoncePublic.multiply(state.nonceShare);
	const rFull = combinedNonce.toAffine();
	const rValue = mod(rFull.x);

	return {
		...state,
		peerNoncePublic,
		combinedNonce,
		rValue,
	};
}

export function serializeKeyShare(keyShare: DKLSKeyShare): DKLSKeyShare {
	return {
		partyId: keyShare.partyId,
		secretShare: keyShare.secretShare,
		publicShare: keyShare.publicShare,
		jointPublicKey: keyShare.jointPublicKey,
	};
}

export function deriveEthereumAddress(jointPublicKeyHex: string): string {
	const pubKeyBytes = hexToBytes(jointPublicKeyHex.replace("0x", ""));
	const point = secp256k1.ProjectivePoint.fromHex(pubKeyBytes);
	const uncompressed = point.toRawBytes(false);
	const pubKeyWithoutPrefix = uncompressed.slice(1);

	const { keccak_256 } = require("@noble/hashes/sha3");
	const hash = keccak_256(pubKeyWithoutPrefix);
	const addressBytes = hash.slice(-20);

	return `0x${bytesToHex(addressBytes)}`;
}

function modInverse(a: bigint, m: bigint = CURVE_ORDER): bigint {
	let [oldR, r] = [a, m];
	let [oldS, s] = [1n, 0n];

	while (r !== 0n) {
		const quotient = oldR / r;
		[oldR, r] = [r, oldR - quotient * r];
		[oldS, s] = [s, oldS - quotient * s];
	}

	return mod(oldS, m);
}

export interface MtAClientState {
	mta1State: import("./mta-protocol").MtAAliceState;
	mta2State: import("./mta-protocol").MtAAliceState;
	mta1Share: bigint | null;
	mta2Share: bigint | null;
}

export function initMtAForSigning(signingState: DKLSSigningClientState): {
	mtaState: MtAClientState;
	mta1Setup: import("./mta-protocol").MtAAliceRound1Serialized;
	mta2Setup: import("./mta-protocol").MtAAliceRound1Serialized;
} {
	const { mtaAliceRound1, serializeMtAAliceRound1 } = require("./mta-protocol");

	const secretShare = BigInt(`0x${signingState.keyShare.secretShare}`);
	const kA_inv = modInverse(signingState.nonceShare);
	const skA_over_kA = mod(secretShare * kA_inv);

	const { state: mta1State, message: mta1Message } = mtaAliceRound1(kA_inv);
	const { state: mta2State, message: mta2Message } =
		mtaAliceRound1(skA_over_kA);

	return {
		mtaState: {
			mta1State,
			mta2State,
			mta1Share: null,
			mta2Share: null,
		},
		mta1Setup: serializeMtAAliceRound1(mta1Message),
		mta2Setup: serializeMtAAliceRound1(mta2Message),
	};
}

export function processMtARound2Response(
	mtaState: MtAClientState,
	mta1Response: import("./mta-protocol").MtABobRound2Serialized,
	mta2Response: import("./mta-protocol").MtABobRound2Serialized,
): {
	mtaState: MtAClientState;
	mta1Encrypted: import("./mta-protocol").MtAAliceRound3Serialized;
	mta2Encrypted: import("./mta-protocol").MtAAliceRound3Serialized;
} {
	const {
		mtaAliceRound3,
		deserializeMtABobRound2,
		serializeMtAAliceRound3,
	} = require("./mta-protocol");

	const mta1BobMsg = deserializeMtABobRound2(mta1Response);
	const {
		state: updatedMta1State,
		message: mta1Message,
		result: mta1Result,
	} = mtaAliceRound3(mtaState.mta1State, mta1BobMsg);

	const mta2BobMsg = deserializeMtABobRound2(mta2Response);
	const {
		state: updatedMta2State,
		message: mta2Message,
		result: mta2Result,
	} = mtaAliceRound3(mtaState.mta2State, mta2BobMsg);

	return {
		mtaState: {
			mta1State: updatedMta1State,
			mta2State: updatedMta2State,
			mta1Share: mta1Result.share,
			mta2Share: mta2Result.share,
		},
		mta1Encrypted: serializeMtAAliceRound3(mta1Message),
		mta2Encrypted: serializeMtAAliceRound3(mta2Message),
	};
}

export function computeClientPartialSignature(
	signingState: DKLSSigningClientState,
	mtaState: MtAClientState,
): { partyId: number; s: string } {
	if (mtaState.mta1Share === null || mtaState.mta2Share === null) {
		throw new Error("MtA shares not computed yet");
	}

	if (!signingState.rValue) {
		throw new Error("Signing state missing rValue");
	}

	const m = signingState.messageHash;
	const r = signingState.rValue;

	const clientPartialS = mod(m * mtaState.mta1Share + r * mtaState.mta2Share);

	return {
		partyId: signingState.partyId,
		s: clientPartialS.toString(16).padStart(64, "0"),
	};
}

export { mod, modInverse };
