import { secp256k1 } from "@noble/curves/secp256k1";

const CURVE_ORDER = secp256k1.CURVE.n;

export function generateRandomScalar(): bigint {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	const scalar = bytesToBigInt(bytes) % CURVE_ORDER;
	return scalar === 0n ? generateRandomScalar() : scalar;
}

export function generatePolynomial(degree: number): bigint[] {
	if (degree < 0 || !Number.isInteger(degree)) {
		throw new Error(`Invalid polynomial degree: ${degree}`);
	}
	const coefficients: bigint[] = [];
	for (let i = 0; i <= degree; i++) {
		coefficients.push(generateRandomScalar());
	}
	return coefficients;
}

export function evaluatePolynomial(coefficients: bigint[], x: bigint): bigint {
	let result = 0n;
	let xPower = 1n;

	for (const coeff of coefficients) {
		result = mod(result + mod(coeff * xPower, CURVE_ORDER), CURVE_ORDER);
		xPower = mod(xPower * x, CURVE_ORDER);
	}

	return result;
}

export function computeCommitments(coefficients: bigint[]): string[] {
	return coefficients.map((coeff) => {
		const point = secp256k1.ProjectivePoint.BASE.multiply(coeff);
		return point.toHex(true);
	});
}

export function verifyShareAgainstCommitments(
	share: bigint,
	partyIndex: bigint,
	commitments: string[],
): boolean {
	const sharePoint = secp256k1.ProjectivePoint.BASE.multiply(share);

	let expectedPoint = secp256k1.ProjectivePoint.fromHex(commitments[0]);
	let indexPower = 1n;

	for (let i = 1; i < commitments.length; i++) {
		indexPower = mod(indexPower * partyIndex, CURVE_ORDER);
		const commitmentPoint = secp256k1.ProjectivePoint.fromHex(commitments[i]);
		expectedPoint = expectedPoint.add(commitmentPoint.multiply(indexPower));
	}

	return sharePoint.equals(expectedPoint);
}

export function combinePublicKeys(commitments: string[][]): string {
	let combined = secp256k1.ProjectivePoint.fromHex(commitments[0][0]);

	for (let i = 1; i < commitments.length; i++) {
		const point = secp256k1.ProjectivePoint.fromHex(commitments[i][0]);
		combined = combined.add(point);
	}

	return combined.toHex(false);
}

export function computeLagrangeCoefficient(
	partyIndex: bigint,
	participatingIndices: bigint[],
): bigint {
	let numerator = 1n;
	let denominator = 1n;

	for (const j of participatingIndices) {
		if (j !== partyIndex) {
			numerator = mod(numerator * (CURVE_ORDER - j), CURVE_ORDER);
			denominator = mod(
				denominator * mod(partyIndex - j, CURVE_ORDER),
				CURVE_ORDER,
			);
		}
	}

	const denominatorInverse = modInverse(denominator, CURVE_ORDER);
	return mod(numerator * denominatorInverse, CURVE_ORDER);
}

export function aggregateShares(
	receivedShares: Map<number, bigint>,
	ownShare: bigint,
): bigint {
	let combined = ownShare;

	for (const share of receivedShares.values()) {
		combined = mod(combined + share, CURVE_ORDER);
	}

	return combined;
}

export function scalarToHex(scalar: bigint): string {
	return scalar.toString(16).padStart(64, "0");
}

export function hexToScalar(hex: string): bigint {
	return BigInt(`0x${hex}`);
}

export function pointToHex(
	point: typeof secp256k1.ProjectivePoint.BASE,
): string {
	return point.toHex(false);
}

export function hexToPoint(hex: string): typeof secp256k1.ProjectivePoint.BASE {
	return secp256k1.ProjectivePoint.fromHex(hex);
}

export function mod(n: bigint, m: bigint): bigint {
	return ((n % m) + m) % m;
}

export function modInverse(a: bigint, m: bigint): bigint {
	let [oldR, r] = [a, m];
	let [oldS, s] = [1n, 0n];

	while (r !== 0n) {
		const quotient = oldR / r;
		[oldR, r] = [r, oldR - quotient * r];
		[oldS, s] = [s, oldS - quotient * s];
	}

	return mod(oldS, m);
}

function bytesToBigInt(bytes: Uint8Array): bigint {
	let result = 0n;
	for (const byte of bytes) {
		result = (result << 8n) + BigInt(byte);
	}
	return result;
}

export { CURVE_ORDER };
