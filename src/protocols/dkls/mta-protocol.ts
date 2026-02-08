/**
 * MtA (Multiplicative-to-Additive) Protocol for DKLS
 *
 * Converts multiplicative shares to additive shares using OT-based multiplication.
 *
 * Given:
 * - Alice has scalar a
 * - Bob has scalar b
 *
 * Output:
 * - Alice gets t_A
 * - Bob gets t_B
 * - Where t_A + t_B = a × b (mod q)
 *
 * Neither party learns the other's input.
 *
 * Protocol rounds:
 * Round 1: Alice (sender) generates BatchCOT setup, sends to Bob
 * Round 2: Bob (receiver) responds with BatchCOT response
 * Round 3: Alice completes BatchCOT, sends encrypted data to Bob
 * Round 4: Bob completes and gets his share
 */

import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import {
	type BatchCOTEncrypted,
	type BatchCOTEncryptedSerialized,
	type BatchCOTReceiverState,
	type BatchCOTResponse,
	type BatchCOTResponseSerialized,
	type BatchCOTSenderState,
	type BatchCOTSetup,
	type BatchCOTSetupSerialized,
	batchCOTReceiverComplete,
	batchCOTReceiverRespond,
	batchCOTSenderComplete,
	batchCOTSenderInit,
	deserializeBatchCOTEncrypted,
	deserializeBatchCOTResponse,
	deserializeBatchCOTSetup,
	serializeBatchCOTEncrypted,
	serializeBatchCOTResponse,
	serializeBatchCOTSetup,
} from "./oblivious-transfer";

const CURVE_ORDER = secp256k1.CURVE.n;

function mod(n: bigint, m: bigint = CURVE_ORDER): bigint {
	const result = n % m;
	return result < 0n ? result + m : result;
}

function randomSessionId(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return `mta_${bytesToHex(bytes)}`;
}

export interface MtAAliceState {
	sessionId: string;
	inputA: bigint;
	cotState: BatchCOTSenderState;
	share: bigint | null;
}

export interface MtABobState {
	sessionId: string;
	inputB: bigint;
	cotState: BatchCOTReceiverState | null;
	share: bigint | null;
}

export interface MtAAliceRound1 {
	sessionId: string;
	setup: BatchCOTSetup;
}

export interface MtABobRound2 {
	sessionId: string;
	response: BatchCOTResponse;
}

export interface MtAAliceRound3 {
	sessionId: string;
	encrypted: BatchCOTEncrypted;
}

export interface MtAResult {
	sessionId: string;
	share: bigint;
}

export interface MtAAliceRound1Serialized {
	sessionId: string;
	setup: BatchCOTSetupSerialized;
}

export interface MtABobRound2Serialized {
	sessionId: string;
	response: BatchCOTResponseSerialized;
}

export interface MtAAliceRound3Serialized {
	sessionId: string;
	encrypted: BatchCOTEncryptedSerialized;
}

export function mtaAliceRound1(inputA: bigint): {
	state: MtAAliceState;
	message: MtAAliceRound1;
} {
	const sessionId = randomSessionId();
	const { state: cotState, setup } = batchCOTSenderInit(inputA);

	return {
		state: {
			sessionId,
			inputA,
			cotState,
			share: null,
		},
		message: {
			sessionId,
			setup,
		},
	};
}

export function mtaBobRound2(
	inputB: bigint,
	aliceMessage: MtAAliceRound1,
): {
	state: MtABobState;
	message: MtABobRound2;
} {
	const { state: cotState, response } = batchCOTReceiverRespond(
		aliceMessage.setup,
		inputB,
	);

	return {
		state: {
			sessionId: aliceMessage.sessionId,
			inputB,
			cotState,
			share: null,
		},
		message: {
			sessionId: aliceMessage.sessionId,
			response,
		},
	};
}

export function mtaAliceRound3(
	state: MtAAliceState,
	bobMessage: MtABobRound2,
): {
	state: MtAAliceState;
	message: MtAAliceRound3;
	result: MtAResult;
} {
	if (state.sessionId !== bobMessage.sessionId) {
		throw new Error("Session ID mismatch");
	}

	const { senderShare, encrypted } = batchCOTSenderComplete(
		state.cotState,
		bobMessage.response,
	);

	const updatedState: MtAAliceState = {
		...state,
		share: senderShare,
	};

	return {
		state: updatedState,
		message: {
			sessionId: state.sessionId,
			encrypted,
		},
		result: {
			sessionId: state.sessionId,
			share: senderShare,
		},
	};
}

export function mtaBobRound4(
	state: MtABobState,
	aliceMessage: MtAAliceRound3,
): MtAResult {
	if (state.sessionId !== aliceMessage.sessionId) {
		throw new Error("Session ID mismatch");
	}

	if (!state.cotState) {
		throw new Error("Bob's COT state not initialized");
	}

	const share = batchCOTReceiverComplete(
		state.cotState,
		aliceMessage.encrypted,
	);

	return {
		sessionId: state.sessionId,
		share,
	};
}

export function verifyMtAResult(
	inputA: bigint,
	inputB: bigint,
	aliceShare: bigint,
	bobShare: bigint,
): boolean {
	const expected = mod(inputA * inputB);
	const actual = mod(aliceShare + bobShare);
	return expected === actual;
}

export function executeMtA(
	inputA: bigint,
	inputB: bigint,
): { aliceShare: bigint; bobShare: bigint } {
	const { state: aliceState1, message: aliceMsg1 } = mtaAliceRound1(inputA);

	const { state: bobState2, message: bobMsg2 } = mtaBobRound2(
		inputB,
		aliceMsg1,
	);

	const { result: aliceResult, message: aliceMsg3 } = mtaAliceRound3(
		aliceState1,
		bobMsg2,
	);

	const bobResult = mtaBobRound4(bobState2, aliceMsg3);

	return {
		aliceShare: aliceResult.share,
		bobShare: bobResult.share,
	};
}

export function serializeMtAAliceRound1(
	msg: MtAAliceRound1,
): MtAAliceRound1Serialized {
	return {
		sessionId: msg.sessionId,
		setup: serializeBatchCOTSetup(msg.setup),
	};
}

export function deserializeMtAAliceRound1(
	serialized: MtAAliceRound1Serialized,
): MtAAliceRound1 {
	return {
		sessionId: serialized.sessionId,
		setup: deserializeBatchCOTSetup(serialized.setup),
	};
}

export function serializeMtABobRound2(
	msg: MtABobRound2,
): MtABobRound2Serialized {
	return {
		sessionId: msg.sessionId,
		response: serializeBatchCOTResponse(msg.response),
	};
}

export function deserializeMtABobRound2(
	serialized: MtABobRound2Serialized,
): MtABobRound2 {
	return {
		sessionId: serialized.sessionId,
		response: deserializeBatchCOTResponse(serialized.response),
	};
}

export function serializeMtAAliceRound3(
	msg: MtAAliceRound3,
): MtAAliceRound3Serialized {
	return {
		sessionId: msg.sessionId,
		encrypted: serializeBatchCOTEncrypted(msg.encrypted),
	};
}

export function deserializeMtAAliceRound3(
	serialized: MtAAliceRound3Serialized,
): MtAAliceRound3 {
	return {
		sessionId: serialized.sessionId,
		encrypted: deserializeBatchCOTEncrypted(serialized.encrypted),
	};
}

export interface MtAwcBobProof {
	commitment: Uint8Array;
	response: bigint;
}

export interface MtAwcBobProofSerialized {
	commitment: string;
	response: string;
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

export function mtawcBobGenerateProof(
	inputB: bigint,
	publicB: ReturnType<typeof secp256k1.ProjectivePoint.fromHex>,
): MtAwcBobProof {
	const G = secp256k1.ProjectivePoint.BASE;

	const k = randomScalar();
	const R = G.multiply(k);

	const commitmentBytes = R.toRawBytes(true);
	const challengeInput = new Uint8Array([
		...commitmentBytes,
		...publicB.toRawBytes(true),
	]);
	const challengeHash = sha256(challengeInput);
	const challenge = mod(BigInt(`0x${bytesToHex(challengeHash)}`));

	const response = mod(k + challenge * inputB);

	return {
		commitment: commitmentBytes,
		response,
	};
}

export function mtawcAliceVerifyProof(
	publicB: ReturnType<typeof secp256k1.ProjectivePoint.fromHex>,
	proof: MtAwcBobProof,
): boolean {
	const G = secp256k1.ProjectivePoint.BASE;

	try {
		const R = secp256k1.ProjectivePoint.fromHex(proof.commitment);

		const challengeInput = new Uint8Array([
			...proof.commitment,
			...publicB.toRawBytes(true),
		]);
		const challengeHash = sha256(challengeInput);
		const challenge = mod(BigInt(`0x${bytesToHex(challengeHash)}`));

		const lhs = G.multiply(proof.response);
		const rhs = R.add(publicB.multiply(challenge));

		return lhs.equals(rhs);
	} catch (error) {
		console.warn(
			"MtAwc proof verification failed:",
			error instanceof Error ? error.message : "unknown error",
		);
		return false;
	}
}

export function serializeMtAwcBobProof(
	proof: MtAwcBobProof,
): MtAwcBobProofSerialized {
	return {
		commitment: bytesToHex(proof.commitment),
		response: proof.response.toString(16).padStart(64, "0"),
	};
}

export function deserializeMtAwcBobProof(
	serialized: MtAwcBobProofSerialized,
): MtAwcBobProof {
	return {
		commitment: hexToBytes(serialized.commitment),
		response: BigInt(`0x${serialized.response}`),
	};
}
