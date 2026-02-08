import { hexToBytes, utf8ToBytes } from "@noble/hashes/utils";
import { getChainConfig } from "../chains/configs";
import type { ChainConfig } from "../chains/types";
import type {
	AddEthereumChainParameter,
	EIP1193Provider,
	ProviderConnectInfo,
	ProviderMessage,
	ProviderRpcError,
	RequestArguments,
	TypedDataDomain,
	TypedDataMessage,
	TypedDataTypes,
} from "./provider-types";
import { EIP1193_ERROR_CODES, createProviderRpcError } from "./provider-types";

type EventListener = (...args: unknown[]) => void;

export interface NeroProviderConfig {
	chainId: number;
	getAccounts: () => string[];
	signMessage: (message: string | Uint8Array) => Promise<string>;
	signTypedData: (
		domain: TypedDataDomain,
		types: TypedDataTypes,
		primaryType: string,
		message: TypedDataMessage,
	) => Promise<string>;
	sendTransaction: (tx: unknown) => Promise<string>;
	onChainChanged?: (chainId: number) => void;
}

export class NeroProvider implements EIP1193Provider {
	private chainId: number;
	private chainConfig: ChainConfig | undefined;
	private listeners: Map<string, Set<EventListener>> = new Map();
	private connected = false;
	private config: NeroProviderConfig;
	private customChains: Map<number, ChainConfig> = new Map();

	constructor(config: NeroProviderConfig) {
		this.config = config;
		this.chainId = config.chainId;
		this.chainConfig = getChainConfig(config.chainId);
	}

	get isNero(): boolean {
		return true;
	}

	get isConnected(): boolean {
		return this.connected;
	}

	async request(args: RequestArguments): Promise<unknown> {
		const { method, params } = args;

		switch (method) {
			case "eth_chainId":
				return this.toHexChainId(this.chainId);

			case "net_version":
				return String(this.chainId);

			case "eth_accounts":
			case "eth_requestAccounts":
				return this.handleRequestAccounts();

			case "eth_sign":
				return this.handleEthSign(params as [string, string]);

			case "personal_sign":
				return this.handlePersonalSign(params as [string, string]);

			case "eth_signTypedData":
			case "eth_signTypedData_v3":
			case "eth_signTypedData_v4":
				return this.handleSignTypedData(params as [string, string]);

			case "eth_sendTransaction":
				return this.handleSendTransaction(params as [unknown]);

			case "wallet_switchEthereumChain":
				return this.handleSwitchChain(params as [{ chainId: string }]);

			case "wallet_addEthereumChain":
				return this.handleAddChain(params as [AddEthereumChainParameter]);

			case "wallet_watchAsset":
				return true;

			case "eth_call":
			case "eth_estimateGas":
			case "eth_getBalance":
			case "eth_getBlockByNumber":
			case "eth_getBlockByHash":
			case "eth_getTransactionByHash":
			case "eth_getTransactionReceipt":
			case "eth_getCode":
			case "eth_getStorageAt":
			case "eth_blockNumber":
			case "eth_gasPrice":
			case "eth_getTransactionCount":
			case "eth_getLogs":
			case "eth_feeHistory":
			case "eth_maxPriorityFeePerGas":
				return this.forwardToRpc(method, params);

			default:
				throw createProviderRpcError(
					EIP1193_ERROR_CODES.UNSUPPORTED_METHOD,
					`Method ${method} is not supported`,
				);
		}
	}

	on(event: "connect", listener: (info: ProviderConnectInfo) => void): this;
	on(event: "disconnect", listener: (error: ProviderRpcError) => void): this;
	on(event: "chainChanged", listener: (chainId: string) => void): this;
	on(event: "accountsChanged", listener: (accounts: string[]) => void): this;
	on(event: "message", listener: (message: ProviderMessage) => void): this;
	on(event: string, listener: (...args: unknown[]) => void): this;
	on(event: string, listener: (...args: any[]) => void): this {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)?.add(listener);
		return this;
	}

	removeListener(event: string, listener: (...args: unknown[]) => void): this {
		this.listeners.get(event)?.delete(listener);
		return this;
	}

	removeAllListeners(event?: string): this {
		if (event) {
			this.listeners.delete(event);
		} else {
			this.listeners.clear();
		}
		return this;
	}

	emit(event: string, ...args: unknown[]): boolean {
		const listeners = this.listeners.get(event);
		if (!listeners || listeners.size === 0) {
			return false;
		}
		for (const listener of listeners) {
			try {
				listener(...args);
			} catch {
				// Ignore listener errors
			}
		}
		return true;
	}

	connect(): void {
		if (this.connected) return;
		this.connected = true;
		const info: ProviderConnectInfo = {
			chainId: this.toHexChainId(this.chainId),
		};
		this.emit("connect", info);
	}

	disconnect(error?: ProviderRpcError): void {
		if (!this.connected) return;
		this.connected = false;
		this.emit(
			"disconnect",
			error ??
				createProviderRpcError(
					EIP1193_ERROR_CODES.DISCONNECTED,
					"Provider disconnected",
				),
		);
	}

	async switchChain(chainId: number): Promise<void> {
		const config = this.getChainConfigById(chainId);
		if (!config) {
			throw createProviderRpcError(
				EIP1193_ERROR_CODES.CHAIN_NOT_ADDED,
				`Chain ${chainId} has not been added`,
			);
		}

		const previousChainId = this.chainId;
		this.chainId = chainId;
		this.chainConfig = config;

		if (previousChainId !== chainId) {
			this.emit("chainChanged", this.toHexChainId(chainId));
			this.config.onChainChanged?.(chainId);
		}
	}

	addChain(config: ChainConfig): void {
		this.customChains.set(config.chainId, config);
	}

	getChainId(): number {
		return this.chainId;
	}

	getChainConfig(): ChainConfig | undefined {
		return this.chainConfig;
	}

	private getChainConfigById(chainId: number): ChainConfig | undefined {
		return getChainConfig(chainId) ?? this.customChains.get(chainId);
	}

	private async handleRequestAccounts(): Promise<string[]> {
		const accounts = this.config.getAccounts();
		if (accounts.length === 0) {
			throw createProviderRpcError(
				EIP1193_ERROR_CODES.UNAUTHORIZED,
				"No accounts available",
			);
		}
		if (!this.connected) {
			this.connect();
		}
		return accounts;
	}

	private async handleEthSign(params: [string, string]): Promise<string> {
		const [address, message] = params;
		this.validateAddress(address);
		return this.config.signMessage(hexToBytes(message.slice(2)));
	}

	private async handlePersonalSign(params: [string, string]): Promise<string> {
		const [message, address] = params;
		this.validateAddress(address);

		const messageBytes = message.startsWith("0x")
			? hexToBytes(message.slice(2))
			: utf8ToBytes(message);

		return this.config.signMessage(messageBytes);
	}

	private async handleSignTypedData(params: [string, string]): Promise<string> {
		const [address, typedDataJson] = params;
		this.validateAddress(address);

		const typedData = JSON.parse(typedDataJson);
		const { domain, types, primaryType, message } = typedData;

		const typesWithoutEIP712Domain = { ...types };
		typesWithoutEIP712Domain.EIP712Domain = undefined;

		return this.config.signTypedData(
			domain,
			typesWithoutEIP712Domain,
			primaryType,
			message,
		);
	}

	private async handleSendTransaction(params: [unknown]): Promise<string> {
		const [tx] = params;
		return this.config.sendTransaction(tx);
	}

	private async handleSwitchChain(
		params: [{ chainId: string }],
	): Promise<null> {
		const [{ chainId }] = params;
		const numericChainId = Number.parseInt(chainId, 16);
		await this.switchChain(numericChainId);
		return null;
	}

	private async handleAddChain(
		params: [AddEthereumChainParameter],
	): Promise<null> {
		const [chainParams] = params;
		const chainId = Number.parseInt(chainParams.chainId, 16);

		const config: ChainConfig = {
			chainId,
			chainName: chainParams.chainName.toLowerCase().replace(/\s+/g, "-"),
			displayName: chainParams.chainName,
			nativeCurrency: chainParams.nativeCurrency,
			rpcUrls: chainParams.rpcUrls,
			blockExplorerUrls: chainParams.blockExplorerUrls,
			isTestnet: false,
		};

		this.addChain(config);
		return null;
	}

	private async forwardToRpc(
		method: string,
		params?: readonly unknown[] | object,
	): Promise<unknown> {
		if (!this.chainConfig?.rpcUrls?.[0]) {
			throw createProviderRpcError(
				EIP1193_ERROR_CODES.CHAIN_DISCONNECTED,
				"No RPC URL available for current chain",
			);
		}

		const response = await fetch(this.chainConfig.rpcUrls[0], {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: Date.now(),
				method,
				params: params ?? [],
			}),
		});

		const data = await response.json();

		if (data.error) {
			throw createProviderRpcError(
				data.error.code ?? EIP1193_ERROR_CODES.INTERNAL_ERROR,
				data.error.message,
				data.error.data,
			);
		}

		return data.result;
	}

	private validateAddress(address: string): void {
		const accounts = this.config.getAccounts();
		const normalizedAddress = address.toLowerCase();
		const hasAccount = accounts.some(
			(a) => a.toLowerCase() === normalizedAddress,
		);

		if (!hasAccount) {
			throw createProviderRpcError(
				EIP1193_ERROR_CODES.UNAUTHORIZED,
				`Address ${address} is not authorized`,
			);
		}
	}

	private toHexChainId(chainId: number): string {
		return `0x${chainId.toString(16)}`;
	}
}

export function createNeroProvider(config: NeroProviderConfig): NeroProvider {
	return new NeroProvider(config);
}
