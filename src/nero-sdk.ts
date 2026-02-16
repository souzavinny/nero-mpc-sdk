import { ChainManager } from "./chains/chain-manager";
import { BUILTIN_CHAINS, getChainConfig } from "./chains/configs";
import type { ChainConfig } from "./chains/types";
import { type EIP1193Provider, NeroProvider } from "./core";
import { ClientKeyManager, generateDeviceKey } from "./core/client-key-manager";
import type {
	TypedDataDomain,
	TypedDataMessage,
	TypedDataTypes,
} from "./core/provider-types";
import { IndexedDBStorage, MemoryStorage } from "./core/secure-storage";
import { DKGClient } from "./protocols/dkg/dkg-client";
import { DKLSClient } from "./protocols/dkls/dkls-client";
import { APIClient } from "./transport/api-client";
import { WebSocketClient } from "./transport/websocket-client";
import type {
	AuthTokens,
	DeviceFingerprint,
	SDKConfig,
	StorageAdapter,
	User,
	WalletInfo,
} from "./types";
import { SDKError } from "./types";
import { SmartWallet } from "./wallet/smart-wallet";

export type OAuthProvider = "google" | "github" | "apple";
export type LoginProvider = OAuthProvider;

export interface NeroSDKState {
	isAuthenticated: boolean;
	isInitialized: boolean;
	hasWallet: boolean;
	user: User | null;
	walletInfo: WalletInfo | null;
	chainId: number;
	isConnected: boolean;
}

export type ConnectionStatus =
	| "connected"
	| "disconnected"
	| "connecting"
	| "errored";

export interface UserInfo {
	email?: string;
	name?: string;
	profileImage?: string;
	verifier?: string;
	verifierId?: string;
	aggregateVerifier?: string;
	typeOfLogin?: string;
	dappShare?: string;
	idToken?: string;
	oAuthIdToken?: string;
	oAuthAccessToken?: string;
}

export class NeroMpcSDK {
	private config: SDKConfig;
	private apiClient: APIClient;
	private wsClient: WebSocketClient | null = null;
	private keyManager: ClientKeyManager | null = null;
	private deviceKey: string | null = null;
	private chainManager: ChainManager;
	private _protocol: "pedersen" | "dkls";

	private _user: User | null = null;
	private _wallet: SmartWallet | null = null;
	private _publicKey: string | null = null;
	private _partyPublicShares: Map<number, string> = new Map();
	private _provider: NeroProvider | null = null;
	private _chainId: number;
	private _connectionStatus: ConnectionStatus = "disconnected";
	private _customChains: Map<number, ChainConfig> = new Map();
	private _cachedWalletInfo: WalletInfo | null = null;
	private _dklsClient: DKLSClient | null = null;
	private _dklsWalletAddress: string | null = null;

	constructor(config: SDKConfig) {
		this.config = {
			chainId: 689,
			storagePrefix: "nero",
			autoConnect: true,
			...config,
		};

		this._protocol = this.config.protocol ?? "pedersen";
		this._chainId = this.config.chainId!;
		this.apiClient = new APIClient(this.config);
		this.chainManager = new ChainManager(this._chainId);

		if (this.config.wsUrl) {
			this.wsClient = new WebSocketClient(this.config.wsUrl);
		}
	}

	get isAuthenticated(): boolean {
		return this._user !== null && this.apiClient.getTokens() !== null;
	}

	get hasWallet(): boolean {
		if (this._protocol === "dkls") {
			return this._dklsWalletAddress !== null;
		}
		return this._wallet !== null;
	}

	get user(): User | null {
		return this._user;
	}

	get wallet(): SmartWallet | null {
		return this._wallet;
	}

	get chainId(): number {
		return this._chainId;
	}

	get connected(): boolean {
		return this._connectionStatus === "connected";
	}

	get status(): ConnectionStatus {
		return this._connectionStatus;
	}

	get provider(): EIP1193Provider | null {
		return this._provider;
	}

	get state(): NeroSDKState {
		return {
			isAuthenticated: this.isAuthenticated,
			isInitialized: this.keyManager !== null,
			hasWallet: this.hasWallet,
			user: this._user,
			walletInfo: this._cachedWalletInfo,
			chainId: this._chainId,
			isConnected: this.connected,
		};
	}

	async getWalletInfo(): Promise<WalletInfo | null> {
		if (!this._wallet) return null;
		this._cachedWalletInfo = await this._wallet.getWalletInfo();
		return this._cachedWalletInfo;
	}

	async initialize(): Promise<void> {
		this.deviceKey = this.loadOrGenerateDeviceKey();
		this.keyManager = new ClientKeyManager(this.deviceKey, {
			storagePrefix: this.config.storagePrefix,
		});

		const storedTokens = this.loadStoredTokens();
		if (storedTokens) {
			this.apiClient.setTokens(storedTokens);

			try {
				this._user = await this.apiClient.getCurrentUser();
				await this.initializeWallet();
			} catch {
				this.apiClient.clearTokens();
				this.clearStoredTokens();
			}
		}
	}

	async getOAuthUrl(
		provider: OAuthProvider,
		redirectUri: string,
	): Promise<{ url: string; state: string }> {
		return this.apiClient.getOAuthUrl(provider, redirectUri);
	}

	async handleOAuthCallback(
		provider: OAuthProvider,
		code: string,
		state: string,
	): Promise<{ user: User; requiresDKG: boolean }> {
		const fingerprint = this.getDeviceFingerprint();
		const skipWallet = this._protocol === "dkls";

		const result = await this.apiClient.handleOAuthCallback(
			provider,
			code,
			state,
			fingerprint,
			{ skipWalletGeneration: skipWallet },
		);

		this._user = result.user;
		this.storeTokens(result.tokens);

		if (this.keyManager && this._user) {
			await this.keyManager.initialize(this._user.id);
		}

		if (this._protocol === "dkls") {
			return {
				user: result.user,
				requiresDKG: result.requiresDKG,
			};
		}

		if (!result.requiresDKG && result.wallet) {
			await this.initializeWallet();
			await this.connect();
		}

		return {
			user: result.user,
			requiresDKG: result.requiresDKG,
		};
	}

	async loginWithGoogle(redirectUri?: string): Promise<void> {
		const { url } = await this.getOAuthUrl(
			"google",
			redirectUri ?? window.location.href,
		);
		window.location.href = url;
	}

	async loginWithGithub(redirectUri?: string): Promise<void> {
		const { url } = await this.getOAuthUrl(
			"github",
			redirectUri ?? window.location.href,
		);
		window.location.href = url;
	}

	async loginWithApple(redirectUri?: string): Promise<void> {
		const { url } = await this.getOAuthUrl(
			"apple",
			redirectUri ?? window.location.href,
		);
		window.location.href = url;
	}

	async generateWallet(): Promise<WalletInfo> {
		if (!this._user) {
			throw new SDKError("User not authenticated", "NOT_AUTHENTICATED");
		}

		if (this._protocol === "dkls") {
			return this.generateWalletDKLS();
		}

		if (!this.keyManager) {
			throw new SDKError("SDK not initialized", "NOT_INITIALIZED");
		}

		const dkgClient = new DKGClient({
			apiClient: this.apiClient,
			wsClient: this.wsClient ?? undefined,
		});

		const result = await dkgClient.execute();

		if (!result.success) {
			throw new SDKError(result.error ?? "DKG failed", "DKG_FAILED");
		}

		const keyShare = dkgClient.getKeyShare();
		if (!keyShare) {
			throw new SDKError("Failed to get key share", "KEY_SHARE_ERROR");
		}

		await this.keyManager.storeKeyShare(keyShare);

		this._publicKey = result.publicKey!;
		this._partyPublicShares = dkgClient.getPartyPublicShares();

		await this.keyManager.storePartyPublicShares(this._partyPublicShares);

		this._wallet = this.createSmartWallet(
			keyShare,
			this._partyPublicShares,
			this._publicKey,
		);

		dkgClient.cleanup();

		await this.connect();

		this._cachedWalletInfo = await this._wallet.getWalletInfo();
		return this._cachedWalletInfo;
	}

	private async generateWalletDKLS(): Promise<WalletInfo> {
		const dklsClient = this.getOrCreateDKLSClient();

		const result = await dklsClient.executeKeygen();

		this._dklsWalletAddress = result.walletAddress;

		await this.connect();

		const walletInfo: WalletInfo = {
			eoaAddress: result.walletAddress,
			publicKey: result.jointPublicKey,
			chainId: this._chainId,
		};

		this._cachedWalletInfo = walletInfo;
		return walletInfo;
	}

	private getOrCreateDKLSClient(): DKLSClient {
		if (!this._dklsClient) {
			const storage = this.createDKLSStorage();
			this._dklsClient = new DKLSClient({
				apiClient: this.apiClient,
				storage,
			});
		}
		return this._dklsClient;
	}

	private createDKLSStorage(): StorageAdapter {
		const prefix = this.config.storagePrefix ?? "nero";
		const isIndexedDBAvailable =
			typeof indexedDB !== "undefined" && indexedDB !== null;
		return isIndexedDBAvailable
			? new IndexedDBStorage(prefix)
			: new MemoryStorage(prefix);
	}

	async logout(): Promise<void> {
		try {
			await this.apiClient.logout();
		} catch {}

		this._user = null;
		this._wallet = null;
		this._publicKey = null;
		this._dklsClient = null;
		this._dklsWalletAddress = null;
		this._connectionStatus = "disconnected";
		this.apiClient.clearTokens();
		this.clearStoredTokens();

		if (this._provider) {
			this._provider.disconnect();
		}

		if (this.wsClient) {
			this.wsClient.disconnect();
		}
	}

	async connect(): Promise<EIP1193Provider> {
		if (this._protocol === "dkls") {
			if (!this._dklsWalletAddress) {
				throw new SDKError("DKLS wallet not available", "NO_WALLET");
			}
		} else if (!this._wallet) {
			throw new SDKError("Wallet not available", "NO_WALLET");
		}

		this._connectionStatus = "connecting";

		try {
			this._provider = new NeroProvider({
				chainId: this._chainId,
				getAccounts: () => this.getAccounts(),
				signMessage: (message) => this.signMessageInternal(message),
				signTypedData: (domain, types, primaryType, message) =>
					this.signTypedDataInternal(domain, types, primaryType, message),
				sendTransaction: (tx) => this.sendTransactionInternal(tx),
				onChainChanged: (chainId) => this.handleChainChanged(chainId),
			});

			this._provider.connect();
			this._connectionStatus = "connected";

			return this._provider;
		} catch (error) {
			this._connectionStatus = "errored";
			throw error;
		}
	}

	async disconnect(): Promise<void> {
		if (this._provider) {
			this._provider.disconnect();
		}
		this._connectionStatus = "disconnected";
		await this.logout();
	}

	getProvider(): EIP1193Provider | null {
		return this._provider;
	}

	getUserInfo(): UserInfo | null {
		if (!this._user) return null;

		return {
			email: this._user.email,
			name: this._user.displayName,
			profileImage: this._user.profilePicture,
			verifier: "nero-mpc",
			verifierId: this._user.id,
			typeOfLogin: "social",
		};
	}

	async switchChain(chainId: number): Promise<void> {
		const config = this.getChainConfigForId(chainId);
		if (!config) {
			throw new SDKError(`Chain ${chainId} not supported`, "UNSUPPORTED_CHAIN");
		}

		this._chainId = chainId;
		await this.chainManager.switchChain(chainId);

		if (this._provider) {
			await this._provider.switchChain(chainId);
		}

		if (this._wallet && this.keyManager) {
			const keyShare = await this.keyManager.getKeyShare();
			if (keyShare) {
				this._wallet = this.createSmartWallet(
					keyShare,
					this._partyPublicShares,
					this._publicKey!,
				);
				this._cachedWalletInfo = await this._wallet.getWalletInfo();
			}
		}
	}

	addChain(config: ChainConfig): void {
		this._customChains.set(config.chainId, config);
		this.chainManager.addChain(config);
		if (this._provider) {
			this._provider.addChain(config);
		}
	}

	getChainConfig(chainId?: number): ChainConfig | undefined {
		const targetChainId = chainId ?? this._chainId;
		return this.getChainConfigForId(targetChainId);
	}

	getSupportedChainIds(): number[] {
		const builtinIds = Array.from(BUILTIN_CHAINS.keys());
		const customIds = Array.from(this._customChains.keys());
		return [...new Set([...builtinIds, ...customIds])];
	}

	private getAccounts(): string[] {
		if (this._protocol === "dkls") {
			return this._dklsWalletAddress ? [this._dklsWalletAddress] : [];
		}
		if (!this._wallet) return [];
		return [this._wallet.eoaAddress];
	}

	private async signMessageInternal(
		message: string | Uint8Array,
	): Promise<string> {
		if (this._protocol === "dkls") {
			const dklsClient = this.getOrCreateDKLSClient();
			const msgStr =
				typeof message === "string"
					? message
					: new TextDecoder().decode(message);
			const result = await dklsClient.signMessage(msgStr);
			return result.signature;
		}
		if (!this._wallet) {
			throw new SDKError("Wallet not available", "NO_WALLET");
		}
		const signature = await this._wallet.signMessage(message);
		return signature.fullSignature;
	}

	private async signTypedDataInternal(
		domain: TypedDataDomain,
		types: TypedDataTypes,
		primaryType: string,
		message: TypedDataMessage,
	): Promise<string> {
		if (this._protocol === "dkls") {
			const dklsClient = this.getOrCreateDKLSClient();
			const result = await dklsClient.signTypedData(
				domain as Record<string, unknown>,
				types as Record<string, Array<{ name: string; type: string }>>,
				message as Record<string, unknown>,
			);
			return result.signature;
		}
		if (!this._wallet) {
			throw new SDKError("Wallet not available", "NO_WALLET");
		}
		const signature = await this._wallet.signTypedData(
			domain as Record<string, unknown>,
			types as Record<string, Array<{ name: string; type: string }>>,
			primaryType,
			message as Record<string, unknown>,
		);
		return signature.fullSignature;
	}

	private async sendTransactionInternal(tx: unknown): Promise<string> {
		if (this._protocol === "dkls") {
			const dklsClient = this.getOrCreateDKLSClient();
			const txRequest = tx as {
				to: string;
				value?: string;
				data?: string;
				nonce?: number;
				gasLimit?: string;
				gasPrice?: string;
				chainId?: number;
			};

			// Use ethers Transaction to compute unsignedHash
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const { Transaction } = require("ethers") as {
				Transaction: {
					from: (data: Record<string, unknown>) => { unsignedHash: string };
				};
			};
			const unsignedTx = Transaction.from({
				to: txRequest.to,
				value: txRequest.value ?? "0x0",
				data: txRequest.data ?? "0x",
				nonce: txRequest.nonce ?? 0,
				gasLimit: txRequest.gasLimit ?? "21000",
				gasPrice: txRequest.gasPrice ?? "0",
				chainId: txRequest.chainId ?? this._chainId,
			});
			const messageHash = unsignedTx.unsignedHash;

			const result = await dklsClient.sign({
				messageHash,
				messageType: "transaction",
				dkgSessionId: "",
			});
			return result.signature;
		}
		if (!this._wallet) {
			throw new SDKError("Wallet not available", "NO_WALLET");
		}
		const txRequest = tx as { to: string; value?: string; data?: string };
		const userOp = await this._wallet.buildUserOperation({
			to: txRequest.to,
			value: txRequest.value ? BigInt(txRequest.value) : undefined,
			data: txRequest.data,
		});
		const result = await this._wallet.sendUserOperation(userOp);
		return result.userOpHash;
	}

	private handleChainChanged(chainId: number): void {
		this._chainId = chainId;
	}

	private getChainConfigForId(chainId: number): ChainConfig | undefined {
		return getChainConfig(chainId) ?? this._customChains.get(chainId);
	}

	private createSmartWallet(
		keyShare: import("./types").KeyShare,
		partyPublicShares: Map<number, string>,
		publicKey: string,
	): SmartWallet {
		const chainConfig = this.getChainConfigForId(this._chainId);
		const rpcConnection = this.chainManager.getRpcConnection();
		const bundlerUrl =
			chainConfig?.bundlerUrl ?? `${this.config.backendUrl}/api/v1/bundler`;

		return new SmartWallet({
			apiClient: this.apiClient,
			keyShare,
			partyPublicShares,
			publicKey,
			chainId: this._chainId,
			rpcConnection,
			bundlerUrl,
			entryPointAddress: chainConfig?.entryPointAddress,
			factoryAddress: chainConfig?.simpleAccountFactoryAddress,
			paymasterUrl: chainConfig?.paymasterUrl,
		});
	}

	async exportBackup(password: string): Promise<string> {
		if (!this.keyManager) {
			throw new SDKError("SDK not initialized", "NOT_INITIALIZED");
		}

		return this.keyManager.exportBackup(password);
	}

	async importBackup(backupString: string, password: string): Promise<void> {
		if (!this.keyManager || !this._user) {
			throw new SDKError("SDK not initialized", "NOT_INITIALIZED");
		}

		const keyShare = await this.keyManager.importBackup(backupString, password);
		await this.keyManager.storeKeyShare(keyShare);

		await this.initializeWallet();
	}

	private async initializeWallet(): Promise<void> {
		if (this._protocol === "dkls") {
			await this.initializeWalletDKLS();
			return;
		}

		if (!this.keyManager || !this._user) {
			return;
		}

		const keyShare = await this.keyManager.getKeyShare();
		if (!keyShare) {
			return;
		}

		const storedPartyShares = await this.keyManager.getPartyPublicShares();
		if (!storedPartyShares) {
			return;
		}

		try {
			const walletInfo = await this.apiClient.getWalletInfo();
			this._publicKey = walletInfo.publicKey;
			this._partyPublicShares = storedPartyShares;

			this._wallet = this.createSmartWallet(
				keyShare,
				this._partyPublicShares,
				this._publicKey,
			);
			this._cachedWalletInfo = await this._wallet.getWalletInfo();
		} catch {}
	}

	private async initializeWalletDKLS(): Promise<void> {
		const dklsClient = this.getOrCreateDKLSClient();
		const keyShare = await dklsClient.loadKeyShare();
		if (!keyShare) {
			return;
		}

		const walletAddress = await dklsClient.getWalletAddress();
		if (walletAddress) {
			this._dklsWalletAddress = walletAddress;
			this._cachedWalletInfo = {
				eoaAddress: walletAddress,
				publicKey: keyShare.jointPublicKey,
				chainId: this._chainId,
			};
		}
	}

	private getDeviceFingerprint(): DeviceFingerprint {
		return {
			userAgent:
				typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
		};
	}

	private loadOrGenerateDeviceKey(): string {
		const storageKey = `${this.config.storagePrefix}:device_key`;

		if (typeof localStorage !== "undefined") {
			const stored = localStorage.getItem(storageKey);
			if (stored) {
				return stored;
			}
		}

		const newKey = generateDeviceKey();

		if (typeof localStorage !== "undefined") {
			localStorage.setItem(storageKey, newKey);
		}

		return newKey;
	}

	private storeTokens(tokens: AuthTokens): void {
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(
				`${this.config.storagePrefix}:tokens`,
				JSON.stringify(tokens),
			);
		}
	}

	private loadStoredTokens(): AuthTokens | null {
		if (typeof localStorage === "undefined") {
			return null;
		}

		const stored = localStorage.getItem(`${this.config.storagePrefix}:tokens`);
		if (!stored) {
			return null;
		}

		try {
			return JSON.parse(stored);
		} catch {
			return null;
		}
	}

	private clearStoredTokens(): void {
		if (typeof localStorage !== "undefined") {
			localStorage.removeItem(`${this.config.storagePrefix}:tokens`);
		}
	}
}

export function createNeroSDK(config: SDKConfig): NeroMpcSDK {
	return new NeroMpcSDK(config);
}
