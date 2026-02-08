import { secp256k1 } from "@noble/curves/secp256k1";
import { describe, expect, it } from "vitest";
import {
	deserializeMtAAliceRound1,
	deserializeMtAAliceRound3,
	deserializeMtABobRound2,
	executeMtA,
	mtaAliceRound1,
	mtaAliceRound3,
	mtaBobRound2,
	mtaBobRound4,
	serializeMtAAliceRound1,
	serializeMtAAliceRound3,
	serializeMtABobRound2,
	verifyMtAResult,
} from "../protocols/dkls/mta-protocol";
import {
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
	verifyBatchCOT,
} from "../protocols/dkls/oblivious-transfer";

const CURVE_ORDER = secp256k1.CURVE.n;

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
	return mod(result);
}

describe("Batch Correlated OT Protocol", () => {
	it("should produce correct multiplication shares", () => {
		const inputA = randomScalar();
		const inputB = randomScalar();

		const { state: senderState, setup } = batchCOTSenderInit(inputA);
		const { state: receiverState, response } = batchCOTReceiverRespond(
			setup,
			inputB,
		);
		const { senderShare, encrypted } = batchCOTSenderComplete(
			senderState,
			response,
		);
		const receiverShare = batchCOTReceiverComplete(receiverState, encrypted);

		expect(verifyBatchCOT(inputA, inputB, senderShare, receiverShare)).toBe(
			true,
		);

		const expected = mod(inputA * inputB);
		const actual = mod(senderShare + receiverShare);
		expect(actual).toBe(expected);
	});

	it("should correctly serialize and deserialize BatchCOT setup", () => {
		const inputA = randomScalar();
		const { setup } = batchCOTSenderInit(inputA);

		const serialized = serializeBatchCOTSetup(setup);
		const deserialized = deserializeBatchCOTSetup(serialized);

		expect(deserialized.setups.length).toBe(setup.setups.length);
		for (let i = 0; i < setup.setups.length; i++) {
			expect(deserialized.setups[i].A.equals(setup.setups[i].A)).toBe(true);
		}
	});

	it("should correctly serialize and deserialize BatchCOT response", () => {
		const inputA = randomScalar();
		const inputB = randomScalar();

		const { setup } = batchCOTSenderInit(inputA);
		const { response } = batchCOTReceiverRespond(setup, inputB);

		const serialized = serializeBatchCOTResponse(response);
		const deserialized = deserializeBatchCOTResponse(serialized);

		expect(deserialized.responses.length).toBe(response.responses.length);
		for (let i = 0; i < response.responses.length; i++) {
			expect(deserialized.responses[i].B.equals(response.responses[i].B)).toBe(
				true,
			);
		}
	});

	it("should correctly serialize and deserialize BatchCOT encrypted", () => {
		const inputA = randomScalar();
		const inputB = randomScalar();

		const { state: senderState, setup } = batchCOTSenderInit(inputA);
		const { response } = batchCOTReceiverRespond(setup, inputB);
		const { encrypted } = batchCOTSenderComplete(senderState, response);

		const serialized = serializeBatchCOTEncrypted(encrypted);
		const deserialized = deserializeBatchCOTEncrypted(serialized);

		expect(deserialized.encrypted.length).toBe(encrypted.encrypted.length);
		for (let i = 0; i < encrypted.encrypted.length; i++) {
			expect(
				Buffer.from(deserialized.encrypted[i].e0).equals(
					Buffer.from(encrypted.encrypted[i].e0),
				),
			).toBe(true);
			expect(
				Buffer.from(deserialized.encrypted[i].e1).equals(
					Buffer.from(encrypted.encrypted[i].e1),
				),
			).toBe(true);
		}
	});
});

describe("MtA Protocol", () => {
	it("should produce correct multiplicative shares in 4 rounds", () => {
		const inputA = randomScalar();
		const inputB = randomScalar();

		const { state: aliceState1, message: aliceMsg1 } = mtaAliceRound1(inputA);
		const { state: bobState, message: bobMsg } = mtaBobRound2(
			inputB,
			aliceMsg1,
		);
		const { result: aliceResult, message: aliceMsg3 } = mtaAliceRound3(
			aliceState1,
			bobMsg,
		);
		const bobResult = mtaBobRound4(bobState, aliceMsg3);

		expect(
			verifyMtAResult(inputA, inputB, aliceResult.share, bobResult.share),
		).toBe(true);
	});

	it("should work with executeMtA convenience function", () => {
		const inputA = randomScalar();
		const inputB = randomScalar();

		const { aliceShare, bobShare } = executeMtA(inputA, inputB);

		expect(verifyMtAResult(inputA, inputB, aliceShare, bobShare)).toBe(true);
	});

	it("should correctly serialize and deserialize MtA round 1 message", () => {
		const inputA = randomScalar();
		const { message } = mtaAliceRound1(inputA);

		const serialized = serializeMtAAliceRound1(message);
		expect(serialized.sessionId).toBe(message.sessionId);
		expect(serialized.setup.setups.length).toBe(256);

		const deserialized = deserializeMtAAliceRound1(serialized);
		expect(deserialized.sessionId).toBe(message.sessionId);
		expect(deserialized.setup.setups.length).toBe(message.setup.setups.length);
	});

	it("should correctly serialize and deserialize MtA round 2 message", () => {
		const inputA = randomScalar();
		const inputB = randomScalar();

		const { message: aliceMsg1 } = mtaAliceRound1(inputA);
		const { message: bobMsg } = mtaBobRound2(inputB, aliceMsg1);

		const serialized = serializeMtABobRound2(bobMsg);
		expect(serialized.sessionId).toBe(bobMsg.sessionId);
		expect(serialized.response.responses.length).toBe(256);

		const deserialized = deserializeMtABobRound2(serialized);
		expect(deserialized.sessionId).toBe(bobMsg.sessionId);
		expect(deserialized.response.responses.length).toBe(
			bobMsg.response.responses.length,
		);
	});

	it("should correctly serialize and deserialize MtA round 3 message", () => {
		const inputA = randomScalar();
		const inputB = randomScalar();

		const { state: aliceState1, message: aliceMsg1 } = mtaAliceRound1(inputA);
		const { message: bobMsg } = mtaBobRound2(inputB, aliceMsg1);
		const { message: aliceMsg3 } = mtaAliceRound3(aliceState1, bobMsg);

		const serialized = serializeMtAAliceRound3(aliceMsg3);
		expect(serialized.sessionId).toBe(aliceMsg3.sessionId);
		expect(serialized.encrypted.encrypted.length).toBe(256);

		const deserialized = deserializeMtAAliceRound3(serialized);
		expect(deserialized.sessionId).toBe(aliceMsg3.sessionId);
		expect(deserialized.encrypted.encrypted.length).toBe(
			aliceMsg3.encrypted.encrypted.length,
		);
	});

	it("should produce correct results after serialization round-trip", () => {
		const inputA = randomScalar();
		const inputB = randomScalar();

		const { state: aliceState1, message: aliceMsg1 } = mtaAliceRound1(inputA);
		const serializedMsg1 = serializeMtAAliceRound1(aliceMsg1);
		const deserializedMsg1 = deserializeMtAAliceRound1(serializedMsg1);

		const { state: bobState, message: bobMsg } = mtaBobRound2(
			inputB,
			deserializedMsg1,
		);
		const serializedMsg2 = serializeMtABobRound2(bobMsg);
		const deserializedMsg2 = deserializeMtABobRound2(serializedMsg2);

		const { result: aliceResult, message: aliceMsg3 } = mtaAliceRound3(
			aliceState1,
			deserializedMsg2,
		);
		const serializedMsg3 = serializeMtAAliceRound3(aliceMsg3);
		const deserializedMsg3 = deserializeMtAAliceRound3(serializedMsg3);

		const bobResult = mtaBobRound4(bobState, deserializedMsg3);

		expect(
			verifyMtAResult(inputA, inputB, aliceResult.share, bobResult.share),
		).toBe(true);
	});

	it("should work correctly for DKLS signing inputs", () => {
		const kA = randomScalar();
		const kB = randomScalar();
		const skA = randomScalar();
		const skB = randomScalar();

		const kA_inv = modInverse(kA);
		const kB_inv = modInverse(kB);
		const skA_over_kA = mod(skA * kA_inv);
		const skB_over_kB = mod(skB * kB_inv);

		const { aliceShare: mtaShare1_A, bobShare: mtaShare1_B } = executeMtA(
			kA_inv,
			kB_inv,
		);
		const { aliceShare: mtaShare2_A, bobShare: mtaShare2_B } = executeMtA(
			skA_over_kA,
			skB_over_kB,
		);

		const k = mod(kA * kB);
		const sk = mod(skA * skB);
		const k_inv = modInverse(k);
		const _sk_over_k = mod(sk * k_inv);

		expect(mod(mtaShare1_A + mtaShare1_B)).toBe(mod(kA_inv * kB_inv));
		expect(mod(mtaShare2_A + mtaShare2_B)).toBe(mod(skA_over_kA * skB_over_kB));
	});
});

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
