import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

const CURVE_ORDER = secp256k1.CURVE.n;

export interface NonceShare {
	k: bigint;
	gamma: bigint;
}

export interface NonceCommitment {
	partyId: number;
	D: string;
	E: string;
	proof: string;
}

export interface NonceDecommitment {
	partyId: number;
	k: bigint;
	gamma: bigint;
}

function mod(n: bigint, m: bigint): bigint {
	return ((n % m) + m) % m;
}

function generateRandomScalar(): bigint {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	let result = 0n;
	for (const byte of bytes) {
		result = (result << 8n) + BigInt(byte);
	}
	const scalar = mod(result, CURVE_ORDER);
	return scalar === 0n ? generateRandomScalar() : scalar;
}

export function generateNonceShare(): NonceShare {
	return {
		k: generateRandomScalar(),
		gamma: generateRandomScalar(),
	};
}

export function createNonceCommitment(
	partyId: number,
	nonce: NonceShare,
): NonceCommitment {
	const G = secp256k1.ProjectivePoint.BASE;

	const D = G.multiply(nonce.gamma);
	const E = G.multiply(nonce.k);

	const proof = createNonceProof(partyId, nonce.k, nonce.gamma, D, E);

	return {
		partyId,
		D: D.toHex(true),
		E: E.toHex(true),
		proof,
	};
}

export function verifyNonceCommitment(commitment: NonceCommitment): boolean {
	try {
		secp256k1.ProjectivePoint.fromHex(commitment.D);
		secp256k1.ProjectivePoint.fromHex(commitment.E);
		return true;
	} catch {
		return false;
	}
}

export function verifyNonceProof(commitment: NonceCommitment): boolean {
	try {
		const G = secp256k1.ProjectivePoint.BASE;
		const D = secp256k1.ProjectivePoint.fromHex(commitment.D);
		const E = secp256k1.ProjectivePoint.fromHex(commitment.E);

		const { R1, R2, s1, s2 } = JSON.parse(commitment.proof);

		if (!/^[0-9a-fA-F]{1,64}$/.test(s1) || !/^[0-9a-fA-F]{1,64}$/.test(s2)) {
			return false;
		}

		const R1Point = secp256k1.ProjectivePoint.fromHex(R1);
		const R2Point = secp256k1.ProjectivePoint.fromHex(R2);
		const s1Scalar = BigInt(`0x${s1}`);
		const s2Scalar = BigInt(`0x${s2}`);

		if (s1Scalar <= 0n || s1Scalar >= CURVE_ORDER) return false;
		if (s2Scalar <= 0n || s2Scalar >= CURVE_ORDER) return false;

		const challenge = computeNonceChallenge(
			commitment.partyId,
			commitment.D,
			commitment.E,
			R1,
			R2,
		);

		const leftSide1 = G.multiply(s1Scalar);
		const rightSide1 = R1Point.add(D.multiply(challenge));
		if (!leftSide1.equals(rightSide1)) return false;

		const leftSide2 = G.multiply(s2Scalar);
		const rightSide2 = R2Point.add(E.multiply(challenge));
		if (!leftSide2.equals(rightSide2)) return false;

		return true;
	} catch {
		return false;
	}
}

function createNonceProof(
	partyId: number,
	k: bigint,
	gamma: bigint,
	D: typeof secp256k1.ProjectivePoint.BASE,
	E: typeof secp256k1.ProjectivePoint.BASE,
): string {
	const G = secp256k1.ProjectivePoint.BASE;

	const r1 = generateRandomScalar();
	const r2 = generateRandomScalar();

	const R1 = G.multiply(r1);
	const R2 = G.multiply(r2);

	const challenge = computeNonceChallenge(
		partyId,
		D.toHex(true),
		E.toHex(true),
		R1.toHex(true),
		R2.toHex(true),
	);

	const s1 = mod(r1 + gamma * challenge, CURVE_ORDER);
	const s2 = mod(r2 + k * challenge, CURVE_ORDER);

	return JSON.stringify({
		R1: R1.toHex(true),
		R2: R2.toHex(true),
		s1: s1.toString(16).padStart(64, "0"),
		s2: s2.toString(16).padStart(64, "0"),
	});
}

function computeNonceChallenge(
	partyId: number,
	D: string,
	E: string,
	R1: string,
	R2: string,
): bigint {
	const input = `${partyId}:${D}:${E}:${R1}:${R2}`;
	const hash = sha256(utf8ToBytes(input));
	return mod(BigInt(`0x${bytesToHex(hash)}`), CURVE_ORDER);
}

export function combineNonceCommitments(commitments: NonceCommitment[]): {
	R: string;
	combinedGamma: string;
} {
	let combinedD = secp256k1.ProjectivePoint.fromHex(commitments[0].D);
	let combinedE = secp256k1.ProjectivePoint.fromHex(commitments[0].E);

	for (let i = 1; i < commitments.length; i++) {
		combinedD = combinedD.add(
			secp256k1.ProjectivePoint.fromHex(commitments[i].D),
		);
		combinedE = combinedE.add(
			secp256k1.ProjectivePoint.fromHex(commitments[i].E),
		);
	}

	return {
		R: combinedE.toHex(true),
		combinedGamma: combinedD.toHex(true),
	};
}

export function computeR(combinedE: string): {
	r: bigint;
	R: string;
	rPoint: { x: bigint; y: bigint };
} {
	const R = secp256k1.ProjectivePoint.fromHex(combinedE);
	const rFull = R.toAffine();
	const r = mod(rFull.x, CURVE_ORDER);

	return {
		r,
		R: R.toHex(true),
		rPoint: { x: rFull.x, y: rFull.y },
	};
}
