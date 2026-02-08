/**
 * Oblivious Transfer (OT) Implementation for DKLS
 *
 * Implements 1-out-of-2 OT using the Simplest OT protocol (Chou-Orlandi).
 * This is based on the Diffie-Hellman assumption on secp256k1.
 *
 * Protocol:
 * 1. Sender generates random a, sends A = a*G
 * 2. Receiver with choice bit c:
 *    - If c=0: sends B = b*G (random b)
 *    - If c=1: sends B = A + b*G (random b)
 * 3. Sender computes:
 *    - k0 = H(a*B) = H(a*b*G)
 *    - k1 = H(a*(B-A)) = H(a*b*G - a*A) = H(a*b*G - a^2*G)
 * 4. Sender encrypts m0 with k0, m1 with k1
 * 5. Receiver computes k_c = H(b*A) and decrypts m_c
 *
 * For Correlated OT (cOT):
 * - Alice inputs correlation Δ
 * - Bob inputs choice bit c
 * - Alice gets random t
 * - Bob gets t + c*Δ
 */

import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

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

function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
	const result = new Uint8Array(a.length);
	for (let i = 0; i < a.length; i++) {
		result[i] = a[i] ^ b[i];
	}
	return result;
}

function scalarToBytes(s: bigint): Uint8Array {
	const hex = s.toString(16).padStart(64, "0");
	return hexToBytes(hex);
}

function bytesToScalar(b: Uint8Array): bigint {
	return BigInt(`0x${bytesToHex(b)}`);
}

export interface OTSenderState {
	privateKey: bigint;
	publicKey: Point;
}

export interface OTReceiverState {
	choiceBit: number;
	privateKey: bigint;
	senderPublicKey: Point;
}

export interface OTSenderSetup {
	A: Point;
}

export interface OTReceiverResponse {
	B: Point;
}

export interface OTSenderEncrypted {
	e0: Uint8Array;
	e1: Uint8Array;
}

export interface OTSenderSetupSerialized {
	A: string;
}

export interface OTReceiverResponseSerialized {
	B: string;
}

export interface OTSenderEncryptedSerialized {
	e0: string;
	e1: string;
}

export function otSenderInit(): { state: OTSenderState; setup: OTSenderSetup } {
	const a = randomScalar();
	const A = G.multiply(a);

	return {
		state: { privateKey: a, publicKey: A },
		setup: { A },
	};
}

export function otReceiverRespond(
	setup: OTSenderSetup,
	choiceBit: number,
): { state: OTReceiverState; response: OTReceiverResponse } {
	if (choiceBit !== 0 && choiceBit !== 1) {
		throw new Error("Choice bit must be 0 or 1");
	}

	const b = randomScalar();
	let B: Point;

	if (choiceBit === 0) {
		B = G.multiply(b);
	} else {
		B = setup.A.add(G.multiply(b));
	}

	return {
		state: {
			choiceBit,
			privateKey: b,
			senderPublicKey: setup.A,
		},
		response: { B },
	};
}

export function otSenderEncrypt(
	state: OTSenderState,
	response: OTReceiverResponse,
	m0: Uint8Array,
	m1: Uint8Array,
): OTSenderEncrypted {
	if (m0.length !== 32 || m1.length !== 32) {
		throw new Error("Messages must be 32 bytes");
	}

	const aB = response.B.multiply(state.privateKey);
	const aBMinusA = response.B.subtract(state.publicKey).multiply(
		state.privateKey,
	);

	const k0 = sha256(aB.toRawBytes(true));
	const k1 = sha256(aBMinusA.toRawBytes(true));

	const e0 = xorBytes(m0, k0);
	const e1 = xorBytes(m1, k1);

	return { e0, e1 };
}

export function otReceiverDecrypt(
	state: OTReceiverState,
	encrypted: OTSenderEncrypted,
): Uint8Array {
	const bA = state.senderPublicKey.multiply(state.privateKey);
	const k = sha256(bA.toRawBytes(true));

	if (state.choiceBit === 0) {
		return xorBytes(encrypted.e0, k);
	}
	return xorBytes(encrypted.e1, k);
}

export interface COTSenderState {
	correlation: bigint;
	otState: OTSenderState;
	randomT: bigint;
}

export interface COTReceiverState {
	choiceBit: number;
	otState: OTReceiverState;
}

export function cotSenderInit(correlation: bigint): {
	state: COTSenderState;
	setup: OTSenderSetup;
} {
	const { state: otState, setup } = otSenderInit();
	const randomT = randomScalar();

	return {
		state: { correlation, otState, randomT },
		setup,
	};
}

export function cotReceiverRespond(
	setup: OTSenderSetup,
	choiceBit: number,
): { state: COTReceiverState; response: OTReceiverResponse } {
	const { state: otState, response } = otReceiverRespond(setup, choiceBit);

	return {
		state: { choiceBit, otState },
		response,
	};
}

export function cotSenderComplete(
	state: COTSenderState,
	response: OTReceiverResponse,
): { senderShare: bigint; encrypted: OTSenderEncrypted } {
	const m0 = scalarToBytes(state.randomT);
	const m1 = scalarToBytes(mod(state.randomT + state.correlation));

	const encrypted = otSenderEncrypt(state.otState, response, m0, m1);

	return {
		senderShare: state.randomT,
		encrypted,
	};
}

export function cotReceiverComplete(
	state: COTReceiverState,
	encrypted: OTSenderEncrypted,
): bigint {
	const decrypted = otReceiverDecrypt(state.otState, encrypted);
	return bytesToScalar(decrypted);
}

export interface BatchCOTSenderState {
	inputA: bigint;
	cotStates: COTSenderState[];
}

export interface BatchCOTReceiverState {
	inputB: bigint;
	cotStates: COTReceiverState[];
}

export interface BatchCOTSetup {
	setups: OTSenderSetup[];
}

export interface BatchCOTResponse {
	responses: OTReceiverResponse[];
}

export interface BatchCOTEncrypted {
	encrypted: OTSenderEncrypted[];
}

export interface BatchCOTSetupSerialized {
	setups: OTSenderSetupSerialized[];
}

export interface BatchCOTResponseSerialized {
	responses: OTReceiverResponseSerialized[];
}

export interface BatchCOTEncryptedSerialized {
	encrypted: OTSenderEncryptedSerialized[];
}

const SCALAR_BITS = 256;

export function batchCOTSenderInit(inputA: bigint): {
	state: BatchCOTSenderState;
	setup: BatchCOTSetup;
} {
	const cotStates: COTSenderState[] = [];
	const setups: OTSenderSetup[] = [];

	for (let j = 0; j < SCALAR_BITS; j++) {
		const correlation = mod(inputA * (1n << BigInt(j)));
		const { state, setup } = cotSenderInit(correlation);
		cotStates.push(state);
		setups.push(setup);
	}

	return {
		state: { inputA, cotStates },
		setup: { setups },
	};
}

export function batchCOTReceiverRespond(
	setup: BatchCOTSetup,
	inputB: bigint,
): { state: BatchCOTReceiverState; response: BatchCOTResponse } {
	const cotStates: COTReceiverState[] = [];
	const responses: OTReceiverResponse[] = [];

	for (let j = 0; j < SCALAR_BITS; j++) {
		const bit = Number((inputB >> BigInt(j)) & 1n);
		const { state, response } = cotReceiverRespond(setup.setups[j], bit);
		cotStates.push(state);
		responses.push(response);
	}

	return {
		state: { inputB, cotStates },
		response: { responses },
	};
}

export function batchCOTSenderComplete(
	state: BatchCOTSenderState,
	response: BatchCOTResponse,
): { senderShare: bigint; encrypted: BatchCOTEncrypted } {
	let totalRandom = 0n;
	const encrypted: OTSenderEncrypted[] = [];

	for (let j = 0; j < SCALAR_BITS; j++) {
		const result = cotSenderComplete(state.cotStates[j], response.responses[j]);
		totalRandom = mod(totalRandom + result.senderShare);
		encrypted.push(result.encrypted);
	}

	return {
		senderShare: mod(CURVE_ORDER - totalRandom),
		encrypted: { encrypted },
	};
}

export function batchCOTReceiverComplete(
	state: BatchCOTReceiverState,
	encrypted: BatchCOTEncrypted,
): bigint {
	let totalShare = 0n;

	for (let j = 0; j < SCALAR_BITS; j++) {
		const share = cotReceiverComplete(
			state.cotStates[j],
			encrypted.encrypted[j],
		);
		totalShare = mod(totalShare + share);
	}

	return totalShare;
}

export function verifyBatchCOT(
	inputA: bigint,
	inputB: bigint,
	senderShare: bigint,
	receiverShare: bigint,
): boolean {
	const expected = mod(inputA * inputB);
	const actual = mod(senderShare + receiverShare);
	return expected === actual;
}

export function serializeBatchCOTSetup(
	setup: BatchCOTSetup,
): BatchCOTSetupSerialized {
	return {
		setups: setup.setups.map((s) => ({ A: s.A.toHex(true) })),
	};
}

export function deserializeBatchCOTSetup(
	serialized: BatchCOTSetupSerialized,
): BatchCOTSetup {
	return {
		setups: serialized.setups.map((s) => ({
			A: secp256k1.ProjectivePoint.fromHex(s.A),
		})),
	};
}

export function serializeBatchCOTResponse(
	response: BatchCOTResponse,
): BatchCOTResponseSerialized {
	return {
		responses: response.responses.map((r) => ({ B: r.B.toHex(true) })),
	};
}

export function deserializeBatchCOTResponse(
	serialized: BatchCOTResponseSerialized,
): BatchCOTResponse {
	return {
		responses: serialized.responses.map((r) => ({
			B: secp256k1.ProjectivePoint.fromHex(r.B),
		})),
	};
}

export function serializeBatchCOTEncrypted(
	encrypted: BatchCOTEncrypted,
): BatchCOTEncryptedSerialized {
	return {
		encrypted: encrypted.encrypted.map((e) => ({
			e0: bytesToHex(e.e0),
			e1: bytesToHex(e.e1),
		})),
	};
}

export function deserializeBatchCOTEncrypted(
	serialized: BatchCOTEncryptedSerialized,
): BatchCOTEncrypted {
	return {
		encrypted: serialized.encrypted.map((e) => ({
			e0: hexToBytes(e.e0),
			e1: hexToBytes(e.e1),
		})),
	};
}
