import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import {
	CURVE_ORDER,
	generateRandomScalar,
	mod,
	scalarToHex,
} from "./polynomial";

export interface PedersenCommitment {
	commitment: string;
	value: bigint;
	blinding: bigint;
}

let H_POINT: typeof secp256k1.ProjectivePoint.BASE | null = null;

function getHPoint(): typeof secp256k1.ProjectivePoint.BASE {
	if (!H_POINT) {
		const hashInput = utf8ToBytes("NERO_MPC_PEDERSEN_H_GENERATOR");
		const hash = sha256(hashInput);
		const scalar = mod(BigInt(`0x${bytesToHex(hash)}`), CURVE_ORDER);
		H_POINT = secp256k1.ProjectivePoint.BASE.multiply(scalar);
	}
	return H_POINT;
}

export function createPedersenCommitment(value: bigint): PedersenCommitment {
	const blinding = generateRandomScalar();
	const G = secp256k1.ProjectivePoint.BASE;
	const H = getHPoint();

	const valuePoint = G.multiply(value);
	const blindingPoint = H.multiply(blinding);
	const commitment = valuePoint.add(blindingPoint);

	return {
		commitment: commitment.toHex(true),
		value,
		blinding,
	};
}

export function verifyPedersenCommitment(
	commitment: string,
	value: bigint,
	blinding: bigint,
): boolean {
	const G = secp256k1.ProjectivePoint.BASE;
	const H = getHPoint();

	const valuePoint = G.multiply(value);
	const blindingPoint = H.multiply(blinding);
	const expectedCommitment = valuePoint.add(blindingPoint);

	const commitmentPoint = secp256k1.ProjectivePoint.fromHex(commitment);
	return expectedCommitment.equals(commitmentPoint);
}

export interface VSSSCommitment {
	partyId: number;
	coefficientCommitments: string[];
	proofOfKnowledge: string;
}

export function createVSSSCommitments(
	partyId: number,
	coefficients: bigint[],
): VSSSCommitment {
	const G = secp256k1.ProjectivePoint.BASE;

	const coefficientCommitments = coefficients.map((coeff) =>
		G.multiply(coeff).toHex(true),
	);

	const proof = createProofOfKnowledge(
		partyId,
		coefficients[0],
		coefficientCommitments[0],
	);

	return {
		partyId,
		coefficientCommitments,
		proofOfKnowledge: proof,
	};
}

export function verifyVSSSCommitment(
	commitment: VSSSCommitment,
	share: bigint,
	receiverPartyId: number,
): boolean {
	const G = secp256k1.ProjectivePoint.BASE;
	const sharePoint = G.multiply(share);

	let expectedPoint = secp256k1.ProjectivePoint.fromHex(
		commitment.coefficientCommitments[0],
	);

	const x = BigInt(receiverPartyId);
	let xPower = x;

	for (let i = 1; i < commitment.coefficientCommitments.length; i++) {
		const commitmentPoint = secp256k1.ProjectivePoint.fromHex(
			commitment.coefficientCommitments[i],
		);
		const scaled = commitmentPoint.multiply(xPower);
		expectedPoint = expectedPoint.add(scaled);
		xPower = mod(xPower * x, CURVE_ORDER);
	}

	return sharePoint.equals(expectedPoint);
}

function createProofOfKnowledge(
	partyId: number,
	secret: bigint,
	publicCommitment: string,
): string {
	const G = secp256k1.ProjectivePoint.BASE;

	const k = generateRandomScalar();
	const R = G.multiply(k);

	const challenge = computeChallenge(partyId, publicCommitment, R.toHex(true));
	const response = mod(k + secret * challenge, CURVE_ORDER);

	return JSON.stringify({
		R: R.toHex(true),
		s: scalarToHex(response),
	});
}

export function verifyProofOfKnowledge(
	proof: string,
	partyId: number,
	publicCommitment: string,
): boolean {
	const G = secp256k1.ProjectivePoint.BASE;

	const { R, s } = JSON.parse(proof);
	const RPoint = secp256k1.ProjectivePoint.fromHex(R);
	const response = BigInt(`0x${s}`);

	const challenge = computeChallenge(partyId, publicCommitment, R);

	const leftSide = G.multiply(response);

	const commitmentPoint = secp256k1.ProjectivePoint.fromHex(publicCommitment);
	const rightSide = RPoint.add(commitmentPoint.multiply(challenge));

	return leftSide.equals(rightSide);
}

function computeChallenge(
	partyId: number,
	commitment: string,
	R: string,
): bigint {
	const input = `${partyId}:${commitment}:${R}`;
	const hash = sha256(utf8ToBytes(input));
	return mod(BigInt(`0x${bytesToHex(hash)}`), CURVE_ORDER);
}

export function combineVSSSCommitments(commitments: VSSSCommitment[]): string {
	let combined = secp256k1.ProjectivePoint.fromHex(
		commitments[0].coefficientCommitments[0],
	);

	for (let i = 1; i < commitments.length; i++) {
		const point = secp256k1.ProjectivePoint.fromHex(
			commitments[i].coefficientCommitments[0],
		);
		combined = combined.add(point);
	}

	return combined.toHex(false);
}
