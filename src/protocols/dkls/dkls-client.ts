/**
 * DKLS Client
 *
 * SDK client for DKLS threshold ECDSA key generation and signing.
 * Communicates with the V2 DKLS API endpoints.
 */

import type { APIClient } from "../../transport/api-client";
import { SDKError, type StorageAdapter } from "../../types";
import {
	type DKLSKeygenClientState,
	type DKLSSigningClientState,
	type MtAClientState,
	computeClientPartialSignature,
	deriveEthereumAddress,
	initMtAForSigning,
	keygenComplete,
	keygenGenerateReveal,
	keygenInitClient,
	keygenProcessBackendCommitment,
	processMtARound2Response,
	signingInit,
	signingProcessBackendNonce,
	signingStoreBackendCommitment,
} from "./crypto";
import type { DKLSKeyShare, DKLSSignRequest, DKLSSigningResult } from "./types";

export interface DKLSClientConfig {
	apiClient: APIClient;
	storage: StorageAdapter;
}

interface StoredKeyShare {
	keyShare: DKLSKeyShare;
	dkgSessionId: string;
}

export class DKLSClient {
	private apiClient: APIClient;
	private storage: StorageAdapter;

	private keygenState: DKLSKeygenClientState | null = null;
	private signingState: DKLSSigningClientState | null = null;
	private mtaState: MtAClientState | null = null;
	private keyShare: DKLSKeyShare | null = null;
	private dkgSessionId: string | null = null;

	constructor(config: DKLSClientConfig) {
		this.apiClient = config.apiClient;
		this.storage = config.storage;
	}

	async loadKeyShare(): Promise<DKLSKeyShare | null> {
		try {
			const stored = await this.storage.get("dkls_key_share");
			if (stored) {
				const parsed = JSON.parse(stored);
				if (parsed.keyShare && parsed.dkgSessionId) {
					this.keyShare = parsed.keyShare;
					this.dkgSessionId = parsed.dkgSessionId;
				} else {
					this.keyShare = parsed;
					this.dkgSessionId = null;
				}
				return this.keyShare;
			}
			return null;
		} catch {
			return null;
		}
	}

	private async saveKeyShare(
		keyShare: DKLSKeyShare,
		dkgSessionId: string,
	): Promise<void> {
		const stored: StoredKeyShare = { keyShare, dkgSessionId };
		await this.storage.set("dkls_key_share", JSON.stringify(stored));
		this.keyShare = keyShare;
		this.dkgSessionId = dkgSessionId;
	}

	async hasKeyShare(): Promise<boolean> {
		const share = await this.loadKeyShare();
		return share !== null;
	}

	async getWalletAddress(): Promise<string | null> {
		const share = await this.loadKeyShare();
		if (!share) return null;
		return deriveEthereumAddress(share.jointPublicKey);
	}

	async executeKeygen(): Promise<{
		walletAddress: string;
		jointPublicKey: string;
	}> {
		try {
			const { state, commitment } = keygenInitClient();
			this.keygenState = state;

			const initResult = await this.apiClient.dklsKeygenInit();

			this.keygenState = keygenProcessBackendCommitment(
				this.keygenState,
				initResult.backendCommitment,
			);

			const clientReveal = keygenGenerateReveal(this.keygenState);

			const commitmentResult = await this.apiClient.dklsKeygenCommitment(
				initResult.sessionId,
				commitment,
			);

			const keyShare = keygenComplete(
				this.keygenState,
				commitmentResult.backendPublicShare,
			);

			const completeResult = await this.apiClient.dklsKeygenComplete(
				initResult.sessionId,
				clientReveal,
			);

			await this.saveKeyShare(keyShare, initResult.sessionId);

			const walletAddress = deriveEthereumAddress(keyShare.jointPublicKey);

			return {
				walletAddress: completeResult.walletAddress || walletAddress,
				jointPublicKey: keyShare.jointPublicKey,
			};
		} catch (error) {
			throw new SDKError(
				error instanceof Error ? error.message : "DKLS keygen failed",
				"DKLS_KEYGEN_FAILED",
			);
		} finally {
			this.keygenState = null;
		}
	}

	async sign(request: DKLSSignRequest): Promise<DKLSSigningResult> {
		const keyShare = await this.loadKeyShare();
		if (!keyShare) {
			throw new SDKError(
				"No key share found. Run keygen first.",
				"NO_KEY_SHARE",
			);
		}

		if (!request.dkgSessionId) {
			throw new SDKError(
				"dkgSessionId is required for signing",
				"MISSING_DKG_SESSION_ID",
			);
		}

		try {
			const initResult = await this.apiClient.dklsSigningInit({
				messageHash: request.messageHash,
				messageType: request.messageType || "message",
				dkgSessionId: request.dkgSessionId,
			});

			const { state, nonceCommitment } = signingInit(
				keyShare,
				request.messageHash,
			);
			this.signingState = state;

			this.signingState = signingStoreBackendCommitment(
				this.signingState,
				initResult.backendNonceCommitment,
			);

			const nonceResult = await this.apiClient.dklsSigningNonce(
				initResult.sessionId,
				nonceCommitment,
			);

			this.signingState = signingProcessBackendNonce(
				this.signingState,
				nonceResult.backendNonceReveal,
			);

			const { mtaState, mta1Setup, mta2Setup } = initMtAForSigning(
				this.signingState,
			);
			this.mtaState = mtaState;

			const mtaRound1Result = await this.apiClient.dklsMtaRound1(
				initResult.sessionId,
				mta1Setup,
				mta2Setup,
			);

			const {
				mtaState: updatedMtaState,
				mta1Encrypted,
				mta2Encrypted,
			} = processMtARound2Response(
				this.mtaState,
				mtaRound1Result.mta1Response,
				mtaRound1Result.mta2Response,
			);
			this.mtaState = updatedMtaState;

			await this.apiClient.dklsMtaRound2(
				initResult.sessionId,
				mta1Encrypted,
				mta2Encrypted,
			);

			const clientPartialSignature = computeClientPartialSignature(
				this.signingState,
				this.mtaState,
			);

			const result = await this.apiClient.dklsSigningPartial(
				initResult.sessionId,
				clientPartialSignature,
			);

			return {
				signature: result.signature,
				r: result.r,
				s: result.s,
				v: result.v,
				messageHash: request.messageHash,
			};
		} catch (error) {
			throw new SDKError(
				error instanceof Error ? error.message : "DKLS signing failed",
				"DKLS_SIGNING_FAILED",
			);
		} finally {
			this.signingState = null;
			this.mtaState = null;
		}
	}

	async signMessage(message: string): Promise<DKLSSigningResult> {
		await this.loadKeyShare();
		if (!this.dkgSessionId) {
			throw new SDKError(
				"No dkgSessionId found. Run keygen first.",
				"NO_DKG_SESSION_ID",
			);
		}

		const { keccak_256 } = require("@noble/hashes/sha3");
		const { bytesToHex, utf8ToBytes } = require("@noble/hashes/utils");

		const prefix = `\x19Ethereum Signed Message:\n${message.length}`;
		const prefixedMessage = utf8ToBytes(prefix + message);
		const messageHash = `0x${bytesToHex(keccak_256(prefixedMessage))}`;

		return this.sign({
			messageHash,
			messageType: "message",
			dkgSessionId: this.dkgSessionId,
		});
	}

	async signTypedData(
		domain: Record<string, unknown>,
		types: Record<string, Array<{ name: string; type: string }>>,
		value: Record<string, unknown>,
	): Promise<DKLSSigningResult> {
		await this.loadKeyShare();
		if (!this.dkgSessionId) {
			throw new SDKError(
				"No dkgSessionId found. Run keygen first.",
				"NO_DKG_SESSION_ID",
			);
		}

		const { TypedDataEncoder } = require("ethers");
		const messageHash = TypedDataEncoder.hash(domain, types, value);

		return this.sign({
			messageHash,
			messageType: "typed_data",
			dkgSessionId: this.dkgSessionId,
		});
	}

	async clearKeyShare(): Promise<void> {
		await this.storage.delete("dkls_key_share");
		this.keyShare = null;
		this.dkgSessionId = null;
	}
}

export function createDKLSClient(
	apiClient: APIClient,
	storage: StorageAdapter,
): DKLSClient {
	return new DKLSClient({ apiClient, storage });
}
