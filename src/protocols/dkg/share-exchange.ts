import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";
import { CURVE_ORDER, hexToScalar, mod, scalarToHex } from "./polynomial";

export interface EncryptedShare {
	fromPartyId: number;
	toPartyId: number;
	ephemeralPublicKey: string;
	ciphertext: string;
	nonce: string;
	tag: string;
}

export interface DecryptedShare {
	fromPartyId: number;
	share: bigint;
}

function toBuffer(data: Uint8Array): ArrayBuffer {
	return data.buffer.slice(
		data.byteOffset,
		data.byteOffset + data.byteLength,
	) as ArrayBuffer;
}

async function deriveSharedSecret(
	privateKey: bigint,
	publicKey: string,
): Promise<Uint8Array> {
	const pubPoint = secp256k1.ProjectivePoint.fromHex(publicKey);
	const sharedPoint = pubPoint.multiply(privateKey);
	const sharedBytes = hexToBytes(sharedPoint.toHex(true));
	return sha256(sharedBytes);
}

async function aesGcmEncrypt(
	plaintext: Uint8Array,
	key: Uint8Array,
	nonce: Uint8Array,
): Promise<{ ciphertext: Uint8Array; tag: Uint8Array }> {
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		toBuffer(key),
		{ name: "AES-GCM" },
		false,
		["encrypt"],
	);

	const encrypted = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv: toBuffer(nonce), tagLength: 128 },
		cryptoKey,
		toBuffer(plaintext),
	);

	const encryptedArray = new Uint8Array(encrypted);
	const ciphertext = encryptedArray.slice(0, -16);
	const tag = encryptedArray.slice(-16);

	return { ciphertext, tag };
}

async function aesGcmDecrypt(
	ciphertext: Uint8Array,
	tag: Uint8Array,
	key: Uint8Array,
	nonce: Uint8Array,
): Promise<Uint8Array> {
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		toBuffer(key),
		{ name: "AES-GCM" },
		false,
		["decrypt"],
	);

	const combined = new Uint8Array(ciphertext.length + tag.length);
	combined.set(ciphertext);
	combined.set(tag, ciphertext.length);

	const decrypted = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: toBuffer(nonce), tagLength: 128 },
		cryptoKey,
		toBuffer(combined),
	);

	return new Uint8Array(decrypted);
}

export async function encryptShare(
	share: bigint,
	fromPartyId: number,
	toPartyId: number,
	recipientPublicKey: string,
): Promise<EncryptedShare> {
	const ephemeralPrivateKey = generateSecureScalar();

	const ephemeralPublicKey =
		secp256k1.ProjectivePoint.BASE.multiply(ephemeralPrivateKey).toHex(true);

	const sharedSecret = await deriveSharedSecret(
		ephemeralPrivateKey,
		recipientPublicKey,
	);

	const nonce = crypto.getRandomValues(new Uint8Array(12));

	const shareHex = scalarToHex(share);
	const plaintext = utf8ToBytes(shareHex);

	const { ciphertext, tag } = await aesGcmEncrypt(
		plaintext,
		sharedSecret,
		nonce,
	);

	return {
		fromPartyId,
		toPartyId,
		ephemeralPublicKey,
		ciphertext: bytesToHex(ciphertext),
		nonce: bytesToHex(nonce),
		tag: bytesToHex(tag),
	};
}

export async function decryptShare(
	encryptedShare: EncryptedShare,
	recipientPrivateKey: bigint,
): Promise<DecryptedShare> {
	const sharedSecret = await deriveSharedSecret(
		recipientPrivateKey,
		encryptedShare.ephemeralPublicKey,
	);

	const ciphertext = hexToBytes(encryptedShare.ciphertext);
	const nonce = hexToBytes(encryptedShare.nonce);
	const tag = hexToBytes(encryptedShare.tag);

	const plaintext = await aesGcmDecrypt(ciphertext, tag, sharedSecret, nonce);
	const shareHex = new TextDecoder().decode(plaintext);
	const share = hexToScalar(shareHex);

	return {
		fromPartyId: encryptedShare.fromPartyId,
		share,
	};
}

function generateSecureScalar(): bigint {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	const scalar = mod(BigInt(`0x${bytesToHex(bytes)}`), CURVE_ORDER);
	if (scalar === 0n) {
		throw new Error("RNG failure: generated zero scalar");
	}
	return scalar;
}

export function generateEphemeralKeyPair(): {
	privateKey: bigint;
	publicKey: string;
} {
	const privateKey = generateSecureScalar();

	const publicKey =
		secp256k1.ProjectivePoint.BASE.multiply(privateKey).toHex(true);

	return { privateKey, publicKey };
}

export function serializeEncryptedShare(share: EncryptedShare): string {
	return JSON.stringify(share);
}

export function deserializeEncryptedShare(data: string): EncryptedShare {
	return JSON.parse(data);
}
