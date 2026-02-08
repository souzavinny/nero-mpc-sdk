import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

function getSubtleCrypto(): SubtleCrypto {
	if (typeof globalThis.crypto?.subtle !== "undefined") {
		return globalThis.crypto.subtle;
	}
	throw new Error("WebCrypto API not available in this environment");
}

function getRandomValues(length: number): Uint8Array {
	const buffer = new Uint8Array(length);
	if (typeof globalThis.crypto?.getRandomValues !== "undefined") {
		globalThis.crypto.getRandomValues(buffer);
		return buffer;
	}
	throw new Error("Secure random not available in this environment");
}

function toBuffer(data: Uint8Array): ArrayBuffer {
	return data.buffer.slice(
		data.byteOffset,
		data.byteOffset + data.byteLength,
	) as ArrayBuffer;
}

export async function deriveKeyFromPassword(
	password: string,
	salt: Uint8Array,
): Promise<CryptoKey> {
	const subtle = getSubtleCrypto();

	const passwordKey = await subtle.importKey(
		"raw",
		toBuffer(utf8ToBytes(password)),
		"PBKDF2",
		false,
		["deriveKey"],
	);

	return subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: toBuffer(salt),
			iterations: PBKDF2_ITERATIONS,
			hash: "SHA-256",
		},
		passwordKey,
		{ name: "AES-GCM", length: KEY_LENGTH },
		false,
		["encrypt", "decrypt"],
	);
}

export async function deriveKeyFromDeviceInfo(
	deviceId: string,
	userId: string,
): Promise<CryptoKey> {
	const combined = `${deviceId}:${userId}`;
	const hash = sha256(utf8ToBytes(combined));

	const subtle = getSubtleCrypto();
	return subtle.importKey(
		"raw",
		toBuffer(hash),
		{ name: "AES-GCM", length: KEY_LENGTH },
		false,
		["encrypt", "decrypt"],
	);
}

export interface EncryptionResult {
	ciphertext: string;
	iv: string;
	salt: string;
}

export async function encryptWithPassword(
	plaintext: string,
	password: string,
): Promise<EncryptionResult> {
	const subtle = getSubtleCrypto();
	const salt = getRandomValues(SALT_LENGTH);
	const iv = getRandomValues(IV_LENGTH);

	const key = await deriveKeyFromPassword(password, salt);

	const ciphertext = await subtle.encrypt(
		{ name: "AES-GCM", iv: toBuffer(iv) },
		key,
		toBuffer(utf8ToBytes(plaintext)),
	);

	return {
		ciphertext: bytesToHex(new Uint8Array(ciphertext)),
		iv: bytesToHex(iv),
		salt: bytesToHex(salt),
	};
}

export async function decryptWithPassword(
	encrypted: EncryptionResult,
	password: string,
): Promise<string> {
	const subtle = getSubtleCrypto();
	const salt = hexToBytes(encrypted.salt);
	const iv = hexToBytes(encrypted.iv);
	const ciphertext = hexToBytes(encrypted.ciphertext);

	const key = await deriveKeyFromPassword(password, salt);

	const plaintext = await subtle.decrypt(
		{ name: "AES-GCM", iv: toBuffer(iv) },
		key,
		toBuffer(ciphertext),
	);

	return new TextDecoder().decode(plaintext);
}

export async function encryptWithKey(
	plaintext: string,
	key: CryptoKey,
): Promise<{ ciphertext: string; iv: string }> {
	const subtle = getSubtleCrypto();
	const iv = getRandomValues(IV_LENGTH);

	const ciphertext = await subtle.encrypt(
		{ name: "AES-GCM", iv: toBuffer(iv) },
		key,
		toBuffer(utf8ToBytes(plaintext)),
	);

	return {
		ciphertext: bytesToHex(new Uint8Array(ciphertext)),
		iv: bytesToHex(iv),
	};
}

export async function decryptWithKey(
	ciphertext: string,
	iv: string,
	key: CryptoKey,
): Promise<string> {
	const subtle = getSubtleCrypto();

	const plaintext = await subtle.decrypt(
		{ name: "AES-GCM", iv: toBuffer(hexToBytes(iv)) },
		key,
		toBuffer(hexToBytes(ciphertext)),
	);

	return new TextDecoder().decode(plaintext);
}

export function generateRandomBytes(length: number): Uint8Array {
	return getRandomValues(length);
}

export function generateRandomHex(length: number): string {
	return bytesToHex(getRandomValues(length));
}

export function hashSha256(data: string | Uint8Array): string {
	const input = typeof data === "string" ? utf8ToBytes(data) : data;
	return bytesToHex(sha256(input));
}

export function computeCommitment(value: string, blinding: string): string {
	const combined = `${value}:${blinding}`;
	return hashSha256(combined);
}

export { bytesToHex, hexToBytes, utf8ToBytes };
