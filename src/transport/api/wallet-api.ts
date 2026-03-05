import type {
	DeviceFingerprint,
	KeyMaterialResponse,
	WalletInfo,
} from "../../types";
import type { RequestFn } from "./types";

export class WalletAPI {
	constructor(private request: RequestFn) {}

	async getInfoV2(): Promise<{
		wallet: {
			address: string | null;
			hasWallet: boolean;
			createdAt: string;
		};
		mpc: {
			threshold: number;
			totalParties: number;
			activeParties: number;
			securityLevel: string;
			protocolVersion: string;
		};
		signing: {
			supported: string[];
		};
	}> {
		return this.request("GET", "/api/v2/wallet/info");
	}

	async list(): Promise<{
		wallets: Array<{
			projectId: string;
			walletAddress: string;
			createdAt: string;
			mpcMode: string;
			thresholdMode: string;
		}>;
		count: number;
	}> {
		return this.request("GET", "/api/v2/wallet/list");
	}

	async getKeyMaterial(
		ephemeralPublicKey: string,
		protocol: "pedersen-dkg-v1" | "dkls" = "pedersen-dkg-v1",
	): Promise<KeyMaterialResponse> {
		return this.request("POST", "/api/v2/wallet/key-material", {
			ephemeralPublicKey,
			protocol,
		});
	}

	async getInfo(): Promise<WalletInfo> {
		return this.request("GET", "/api/v2/wallet/info");
	}

	async signingInit(
		messageHash: string,
		messageType: "transaction" | "message" | "typed_data" = "message",
	): Promise<{
		sessionId: string;
		backendNonceCommitment: {
			partyId: number;
			D: string;
			E: string;
			proof: string;
		};
		enhancedProof?: unknown;
	}> {
		return this.request("POST", "/api/v2/wallet/signing/init", {
			messageHash,
			messageType,
		});
	}

	async signingNonce(
		sessionId: string,
		clientNonceCommitment: {
			partyId: number;
			D: string;
			E: string;
			proof: string;
		},
	): Promise<{
		sessionId: string;
		backendPartialSignature: {
			partyId: number;
			sigma: string;
			publicShare: string;
			nonceCommitment: string;
		};
	}> {
		return this.request("POST", "/api/v2/wallet/signing/nonce", {
			sessionId,
			clientNonceCommitment,
		});
	}

	async signingComplete(
		sessionId: string,
		clientPartialSignature: {
			partyId: number;
			sigma: string;
			publicShare: string;
			nonceCommitment: string;
		},
	): Promise<{
		sessionId: string;
		signature: string;
		r: string;
		s: string;
		v: number;
		messageHash: string;
		walletAddress: string | null;
	}> {
		return this.request("POST", "/api/v2/wallet/signing/complete", {
			sessionId,
			clientPartialSignature,
		});
	}

	async signingStatus(sessionId: string): Promise<{
		sessionId: string;
		status: string;
		messageHash: string;
		messageType: string;
		result?: {
			signature: string;
			r: string;
			s: string;
			v: number;
		};
		error?: string;
		createdAt: string;
		completedAt?: string;
	}> {
		return this.request("GET", `/api/v2/wallet/signing/${sessionId}`);
	}

	async initiateDeviceVerification(
		fingerprint: DeviceFingerprint,
		deviceName?: string,
	): Promise<{
		verificationId: string;
		expiresAt: string;
	}> {
		return this.request("POST", "/api/user/devices/verify/initiate", {
			fingerprint,
			deviceName,
		});
	}

	async completeDeviceVerification(
		verificationId: string,
		code: string,
		fingerprint: DeviceFingerprint,
	): Promise<{
		deviceId: string;
		trustLevel: string;
	}> {
		return this.request("POST", "/api/user/devices/verify/complete", {
			verificationId,
			code,
			fingerprint,
		});
	}
}
