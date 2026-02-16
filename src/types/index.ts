export interface KeyShare {
	partyId: number;
	privateShare: string;
	publicShare: string;
	commitment: string;
	threshold: number;
	totalParties: number;
	protocolVersion: string;
}

export interface EncryptedKeyShare {
	ciphertext: string;
	iv: string;
	salt: string;
	version: number;
}

export interface DKGCommitment {
	partyId: number;
	commitments: string[];
	publicKey: string;
}

export interface DKGShare {
	fromPartyId: number;
	toPartyId: number;
	encryptedShare: string;
}

export interface DKGResult {
	success: boolean;
	publicKey?: string;
	walletAddress?: string;
	partyId?: number;
	error?: string;
}

export interface SigningRequest {
	messageHash: string;
	messageType: "transaction" | "message" | "typed_data";
	metadata?: Record<string, unknown>;
}

export interface PartialSignature {
	partyId: number;
	r: string;
	s: string;
	publicShare: string;
	nonceCommitment: string;
}

export interface Signature {
	r: string;
	s: string;
	v: number;
	fullSignature: string;
}

export interface SigningResult {
	success: boolean;
	signature?: Signature;
	error?: string;
}

export type DKGRound =
	| "commitment"
	| "share_exchange"
	| "verification"
	| "complete";

export interface DKGSessionState {
	sessionId: string;
	round: DKGRound;
	partyId: number;
	participantCount: number;
	threshold: number;
	commitments: Map<number, DKGCommitment>;
	receivedShares: Map<number, DKGShare>;
	polynomial?: bigint[];
	privateShare?: bigint;
	publicKey?: string;
}

export type SigningRound =
	| "nonce_commitment"
	| "nonce_exchange"
	| "partial_signature"
	| "complete";

export interface SigningSessionState {
	sessionId: string;
	round: SigningRound;
	messageHash: string;
	participatingParties: number[];
	nonceCommitments: Map<number, string>;
	partialSignatures: Map<number, PartialSignature>;
}

export interface UIConfig {
	appName: string;
	logoLight?: string;
	logoDark?: string;
	mode?: "light" | "dark" | "auto";
	theme?: {
		primary?: string;
		secondary?: string;
		background?: string;
		text?: string;
		border?: string;
	};
	defaultLanguage?: string;
}

export interface SDKConfig {
	backendUrl: string;
	apiKey?: string;
	deviceId?: string;
	chainId?: number;
	wsUrl?: string;
	storagePrefix?: string;
	autoConnect?: boolean;
	uiConfig?: UIConfig;
	sessionTime?: number;
	web3AuthClientId?: string;
	protocol?: "pedersen" | "dkls";
}

export interface AuthTokens {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	dappShare?: string;
}

export interface User {
	id: string;
	email?: string;
	displayName?: string;
	profilePicture?: string;
	walletAddress?: string;
	createdAt: Date;
}

export interface DeviceFingerprint {
	userAgent: string;
	ipAddress?: string;
	additionalData?: string;
}

export interface WalletInfo {
	eoaAddress: string;
	smartWalletAddress?: string;
	publicKey: string;
	chainId: number;
}

export type ProtocolMessageType =
	| "dkg:commitment"
	| "dkg:share"
	| "dkg:verification"
	| "dkg:complete"
	| "signing:nonce_commitment"
	| "signing:nonce"
	| "signing:partial_signature"
	| "signing:complete"
	| "error";

export interface ProtocolMessage {
	type: ProtocolMessageType;
	sessionId: string;
	fromPartyId: number;
	toPartyId?: number;
	payload: unknown;
	timestamp: number;
	signature?: string;
}

export interface StorageAdapter {
	get(key: string): Promise<string | null>;
	set(key: string, value: string): Promise<void>;
	delete(key: string): Promise<void>;
	clear(): Promise<void>;
}

export interface SessionStatus {
	isValid: boolean;
	userId: string;
	sessionLifetime: number;
	deviceId?: string;
	projectId?: string;
}

export interface SessionReconnectResult {
	user: User;
	tokens: AuthTokens;
	sessionLifetime: number;
}

export interface CustomLoginOptions {
	verifierId: string;
	idToken: string;
	deviceId?: string;
	deviceName?: string;
	skipWalletGeneration?: boolean;
}

export interface OAuthProviderInfo {
	provider: string;
	name: string;
}

export interface SocialLoginResponse {
	user: User;
	tokens: {
		accessToken: string;
		refreshToken: string;
		expiresIn: number;
	};
	isFirstLogin: boolean;
	wallet?: {
		walletAddress?: string;
		keyGenSessionId?: string;
		requiresKeyGeneration: boolean;
		status?: string;
		expiresAt?: string;
		error?: string;
	};
	dappShare?: string;
}

export class SDKError extends Error {
	constructor(
		message: string,
		public code: string,
		public statusCode?: number,
	) {
		super(message);
		this.name = "SDKError";
	}
}
