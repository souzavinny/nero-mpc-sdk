import { secp256k1 } from "@noble/curves/secp256k1";
import { hkdf } from "@noble/hashes/hkdf";
import { scryptAsync } from "@noble/hashes/scrypt";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";
import {
	CURVE_ORDER,
	hexToScalar,
	mod,
	scalarToHex,
} from "../protocols/dkg/polynomial";
import {
	type EncryptedShare,
	decryptShare,
} from "../protocols/dkg/share-exchange";
import { deriveEthereumAddress } from "../protocols/dkls/crypto";
import type { APIClient } from "../transport/api-client";
import type { SelfCustodyCompositeBlob } from "../types";
import { SDKError } from "../types";
import { generateRandomBytes } from "./crypto-primitives";

const BASE = secp256k1.ProjectivePoint.BASE;

const DEFAULT_KDF_PARAMS = { N: 131072, r: 8, p: 1 };

const MIN_PASSWORD_LENGTH = 12;

function toBuffer(data: Uint8Array): ArrayBuffer {
	return data.buffer.slice(
		data.byteOffset,
		data.byteOffset + data.byteLength,
	) as ArrayBuffer;
}

async function aesGcmEncryptRaw(
	plaintext: Uint8Array,
	key: Uint8Array,
): Promise<{ ciphertext: string; nonce: string; tag: string }> {
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		toBuffer(key),
		{ name: "AES-GCM" },
		false,
		["encrypt"],
	);
	const nonce = crypto.getRandomValues(new Uint8Array(12));
	const encrypted = new Uint8Array(
		await crypto.subtle.encrypt(
			{ name: "AES-GCM", iv: toBuffer(nonce), tagLength: 128 },
			cryptoKey,
			toBuffer(plaintext),
		),
	);
	return {
		ciphertext: bytesToHex(encrypted.slice(0, -16)),
		nonce: bytesToHex(nonce),
		tag: bytesToHex(encrypted.slice(-16)),
	};
}

async function aesGcmDecryptRaw(
	ciphertext: string,
	nonce: string,
	tag: string,
	key: Uint8Array,
): Promise<Uint8Array> {
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		toBuffer(key),
		{ name: "AES-GCM" },
		false,
		["decrypt"],
	);
	const ctBytes = hexToBytes(ciphertext);
	const tagBytes = hexToBytes(tag);
	const combined = new Uint8Array(ctBytes.length + tagBytes.length);
	combined.set(ctBytes);
	combined.set(tagBytes, ctBytes.length);
	return new Uint8Array(
		await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: toBuffer(hexToBytes(nonce)), tagLength: 128 },
			cryptoKey,
			toBuffer(combined),
		),
	);
}

function deriveClientShareKey(seed: Uint8Array): Uint8Array {
	return hkdf(
		sha256,
		seed,
		undefined,
		"nero-mpc:self-custody:client-share",
		32,
	);
}

export async function deriveRecoverySeed(
	password: string,
	salt: Uint8Array,
	params: { N: number; r: number; p: number } = DEFAULT_KDF_PARAMS,
): Promise<Uint8Array> {
	return scryptAsync(utf8ToBytes(password), salt, {
		N: params.N,
		r: params.r,
		p: params.p,
		dkLen: 32,
	});
}

// Bias from 256-bit value mod ~256-bit order is ~2^-128, cryptographically negligible
export function seedToScalar(seed: Uint8Array): bigint {
	const scalar = mod(BigInt(`0x${bytesToHex(seed)}`), CURVE_ORDER);
	if (scalar === 0n) {
		throw new SDKError(
			"Recovery seed produced zero scalar",
			"SELF_CUSTODY_SETUP_FAILED",
		);
	}
	return scalar;
}

export function seedToPublicKey(seed: Uint8Array): string {
	return BASE.multiply(seedToScalar(seed)).toHex(true);
}

export async function buildCompositeBlob(
	clientShareHex: string,
	backendShareBlob: SelfCustodyCompositeBlob["backendShareBlob"],
	sharingType: "multiplicative" | "additive",
	kdfSalt: string,
	kdfParams: { N: number; r: number; p: number },
	seed: Uint8Array,
): Promise<string> {
	const shareKey = deriveClientShareKey(seed);
	const encryptedClientShare = await aesGcmEncryptRaw(
		utf8ToBytes(clientShareHex),
		shareKey,
	);

	const blob: SelfCustodyCompositeBlob = {
		version: 2,
		encryptedClientShare,
		backendShareBlob,
		sharingType,
		kdfSalt,
		kdfParams,
	};
	return JSON.stringify(blob);
}

export function parseCompositeBlob(json: string): SelfCustodyCompositeBlob {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		throw new SDKError(
			"Invalid composite blob: not valid JSON",
			"INVALID_COMPOSITE_BLOB",
		);
	}

	const blob = parsed as Record<string, unknown>;

	if (
		!blob ||
		typeof blob !== "object" ||
		blob.version !== 2 ||
		!blob.encryptedClientShare ||
		!blob.backendShareBlob ||
		typeof blob.sharingType !== "string" ||
		typeof blob.kdfSalt !== "string" ||
		!blob.kdfParams
	) {
		throw new SDKError(
			"Invalid composite blob: missing or wrong fields",
			"INVALID_COMPOSITE_BLOB",
		);
	}

	return parsed as SelfCustodyCompositeBlob;
}

function validatePassword(password: string): void {
	if (password.length < MIN_PASSWORD_LENGTH) {
		throw new SDKError(
			`Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
			"SELF_CUSTODY_SETUP_FAILED",
		);
	}
}

export function hashPasswordForFactor(password: string): string {
	const hash = sha256(utf8ToBytes(password));
	return bytesToHex(hash);
}

export async function setupSelfCustodyRecovery({
	password,
	clientShareHex,
	apiClient,
	protocol,
}: {
	password: string;
	clientShareHex: string;
	apiClient: APIClient;
	protocol: "dkls" | "pedersen-dkg-v1";
}): Promise<string> {
	validatePassword(password);

	const salt = generateRandomBytes(32);
	const seed = await deriveRecoverySeed(password, salt);

	try {
		const recoveryPk = seedToPublicKey(seed);
		const response = await apiClient.getKeyMaterial(recoveryPk, protocol);

		const compositeJson = await buildCompositeBlob(
			clientShareHex,
			{
				ephemeralPublicKey: response.encryptedShare.ephemeralPublicKey,
				ciphertext: response.encryptedShare.ciphertext,
				nonce: response.encryptedShare.nonce,
				tag: response.encryptedShare.tag,
			},
			response.metadata.sharingType,
			bytesToHex(salt),
			DEFAULT_KDF_PARAMS,
			seed,
		);

		return compositeJson;
	} finally {
		seed.fill(0);
	}
}

export async function extractClientShare(
	compositeJson: string,
	password: string,
): Promise<string> {
	const blob = parseCompositeBlob(compositeJson);
	const salt = hexToBytes(blob.kdfSalt);
	const seed = await deriveRecoverySeed(password, salt, blob.kdfParams);
	try {
		const shareKey = deriveClientShareKey(seed);
		const plaintext = await aesGcmDecryptRaw(
			blob.encryptedClientShare.ciphertext,
			blob.encryptedClientShare.nonce,
			blob.encryptedClientShare.tag,
			shareKey,
		);
		return new TextDecoder().decode(plaintext);
	} finally {
		seed.fill(0);
	}
}

export async function offlineReconstructKey({
	compositeJson,
	password,
	expectedAddress,
}: {
	compositeJson: string;
	password: string;
	expectedAddress?: string;
}): Promise<{ privateKey: string; walletAddress: string }> {
	const blob = parseCompositeBlob(compositeJson);

	const salt = hexToBytes(blob.kdfSalt);
	const seed = await deriveRecoverySeed(password, salt, blob.kdfParams);

	try {
		const shareKey = deriveClientShareKey(seed);
		const clientSharePlain = await aesGcmDecryptRaw(
			blob.encryptedClientShare.ciphertext,
			blob.encryptedClientShare.nonce,
			blob.encryptedClientShare.tag,
			shareKey,
		);
		const skA = hexToScalar(new TextDecoder().decode(clientSharePlain));

		const seedScalar = seedToScalar(seed);

		const encryptedShare: EncryptedShare = {
			fromPartyId: 2,
			toPartyId: 1,
			ephemeralPublicKey: blob.backendShareBlob.ephemeralPublicKey,
			ciphertext: blob.backendShareBlob.ciphertext,
			nonce: blob.backendShareBlob.nonce,
			tag: blob.backendShareBlob.tag,
		};

		const { share: skB } = await decryptShare(encryptedShare, seedScalar);

		let sk: bigint;
		if (blob.sharingType === "multiplicative") {
			sk = mod(skA * skB, CURVE_ORDER);
		} else {
			// Additive: full key = sk_A + sk_B, where sk_B = fullKey - sk_A
			// and the backend stored sk_B = fullKey - sk_A, so sk = 2*sk_A - sk_B
			sk = mod(2n * skA - skB, CURVE_ORDER);
		}

		const pubKeyHex = BASE.multiply(sk).toHex(false);
		const walletAddress = deriveEthereumAddress(pubKeyHex);

		if (
			expectedAddress &&
			walletAddress.toLowerCase() !== expectedAddress.toLowerCase()
		) {
			throw new SDKError(
				`Address mismatch: expected ${expectedAddress}, got ${walletAddress}`,
				"SELF_CUSTODY_RECOVERY_FAILED",
			);
		}

		return {
			privateKey: `0x${scalarToHex(sk)}`,
			walletAddress,
		};
	} finally {
		seed.fill(0);
	}
}
