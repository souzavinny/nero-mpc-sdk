import { secp256k1 } from "@noble/curves/secp256k1";

const CURVE_ORDER = secp256k1.CURVE.n;
const G = secp256k1.ProjectivePoint.BASE;

export interface PartialSignatureData {
	partyId: number;
	sigma: bigint;
	publicShare: string;
	nonceCommitment: string;
}

function mod(n: bigint, m: bigint): bigint {
	return ((n % m) + m) % m;
}

function modInverse(a: bigint, m: bigint): bigint {
	let [oldR, r] = [a, m];
	let [oldS, s] = [1n, 0n];

	while (r !== 0n) {
		const quotient = oldR / r;
		[oldR, r] = [r, oldR - quotient * r];
		[oldS, s] = [s, oldS - quotient * s];
	}

	return mod(oldS, m);
}

export function computeLagrangeCoefficient(
	partyId: number,
	participatingParties: number[],
): bigint {
	let numerator = 1n;
	let denominator = 1n;

	const i = BigInt(partyId);

	for (const j of participatingParties) {
		if (j !== partyId) {
			const jBig = BigInt(j);
			numerator = mod(numerator * (CURVE_ORDER - jBig), CURVE_ORDER);
			denominator = mod(denominator * mod(i - jBig, CURVE_ORDER), CURVE_ORDER);
		}
	}

	const denominatorInverse = modInverse(denominator, CURVE_ORDER);
	return mod(numerator * denominatorInverse, CURVE_ORDER);
}

export function computePartialSignature(
	partyId: number,
	keyShare: bigint,
	nonceK: bigint,
	_nonceGamma: bigint,
	messageHash: bigint,
	r: bigint,
	participatingParties: number[],
): PartialSignatureData {
	const lambda = computeLagrangeCoefficient(partyId, participatingParties);

	const kInverse = modInverse(nonceK, CURVE_ORDER);

	const adjustedShare = mod(keyShare * lambda, CURVE_ORDER);
	const sigma = mod(kInverse * (messageHash + r * adjustedShare), CURVE_ORDER);

	const publicShare = G.multiply(keyShare).toHex(true);
	const nonceCommitment = G.multiply(nonceK).toHex(true);

	return {
		partyId,
		sigma,
		publicShare,
		nonceCommitment,
	};
}

export function combinePartialSignatures(
	partials: PartialSignatureData[],
	r: bigint,
	combinedRPoint: { x: bigint; y: bigint },
): { r: bigint; s: bigint; v: number } {
	let s = 0n;

	for (const partial of partials) {
		s = mod(s + partial.sigma, CURVE_ORDER);
	}

	let v = combinedRPoint.y % 2n === 0n ? 27 : 28;

	if (s > CURVE_ORDER / 2n) {
		s = CURVE_ORDER - s;
		v = v === 27 ? 28 : 27;
	}

	return { r, s, v };
}

export function verifyPartialSignature(
	partial: PartialSignatureData,
	expectedPublicShare: string,
	expectedNonceCommitment: string,
	r: bigint,
	messageHash: bigint,
	participatingParties: number[],
): boolean {
	if (partial.sigma <= 0n || partial.sigma >= CURVE_ORDER) {
		return false;
	}

	if (!partial.publicShare || !partial.nonceCommitment) {
		return false;
	}

	if (expectedPublicShare && partial.publicShare !== expectedPublicShare) {
		return false;
	}

	if (
		expectedNonceCommitment &&
		partial.nonceCommitment !== expectedNonceCommitment
	) {
		return false;
	}

	let R_i: typeof G;
	try {
		R_i = secp256k1.ProjectivePoint.fromHex(partial.nonceCommitment);
	} catch {
		return false;
	}

	let P_i: typeof G;
	try {
		P_i = secp256k1.ProjectivePoint.fromHex(partial.publicShare);
	} catch {
		return false;
	}

	const lambda = computeLagrangeCoefficient(
		partial.partyId,
		participatingParties,
	);

	const rTimesLambda = mod(r * lambda, CURVE_ORDER);

	const leftSide = R_i.multiply(partial.sigma);

	const rightSide = G.multiply(messageHash).add(P_i.multiply(rTimesLambda));

	return leftSide.equals(rightSide);
}

export function formatSignature(r: bigint, s: bigint, v: number): string {
	const rHex = r.toString(16).padStart(64, "0");
	const sHex = s.toString(16).padStart(64, "0");
	const vHex = v.toString(16).padStart(2, "0");

	return `0x${rHex}${sHex}${vHex}`;
}

export function parseMessageHash(hash: string): bigint {
	const cleanHash = hash.startsWith("0x") ? hash.slice(2) : hash;
	return BigInt(`0x${cleanHash}`);
}
