import { BUILTIN_CHAINS, getChainConfig } from "./configs";
import type { ChainConfig } from "./types";

type ChainChangeListener = (chainId: number, config: ChainConfig) => void;

export class ChainManager {
	private currentChainId: number;
	private customChains: Map<number, ChainConfig> = new Map();
	private listeners: Set<ChainChangeListener> = new Set();
	private rpcConnections: Map<number, RpcConnection> = new Map();

	constructor(initialChainId = 689) {
		this.currentChainId = initialChainId;
	}

	get chainId(): number {
		return this.currentChainId;
	}

	get chainConfig(): ChainConfig | undefined {
		return this.getConfig(this.currentChainId);
	}

	getConfig(chainId: number): ChainConfig | undefined {
		return getChainConfig(chainId) ?? this.customChains.get(chainId);
	}

	getSupportedChains(): ChainConfig[] {
		const builtins = Array.from(BUILTIN_CHAINS.values());
		const custom = Array.from(this.customChains.values());
		return [...builtins, ...custom];
	}

	getSupportedChainIds(): number[] {
		return this.getSupportedChains().map((c) => c.chainId);
	}

	isChainSupported(chainId: number): boolean {
		return this.getConfig(chainId) !== undefined;
	}

	addChain(config: ChainConfig): void {
		this.customChains.set(config.chainId, config);
	}

	removeChain(chainId: number): boolean {
		if (BUILTIN_CHAINS.has(chainId)) {
			return false;
		}
		return this.customChains.delete(chainId);
	}

	async switchChain(chainId: number): Promise<ChainConfig> {
		const config = this.getConfig(chainId);
		if (!config) {
			throw new Error(`Chain ${chainId} is not supported`);
		}

		const previousChainId = this.currentChainId;
		this.currentChainId = chainId;

		if (previousChainId !== chainId) {
			this.notifyListeners(chainId, config);
		}

		return config;
	}

	onChainChange(listener: ChainChangeListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notifyListeners(chainId: number, config: ChainConfig): void {
		for (const listener of this.listeners) {
			try {
				listener(chainId, config);
			} catch {
				// Ignore listener errors
			}
		}
	}

	getRpcConnection(chainId?: number): RpcConnection {
		const targetChainId = chainId ?? this.currentChainId;

		let connection = this.rpcConnections.get(targetChainId);
		if (!connection) {
			const config = this.getConfig(targetChainId);
			if (!config) {
				throw new Error(`Chain ${targetChainId} is not supported`);
			}
			connection = new RpcConnection(config);
			this.rpcConnections.set(targetChainId, connection);
		}

		return connection;
	}

	getTestnets(): ChainConfig[] {
		return this.getSupportedChains().filter((c) => c.isTestnet);
	}

	getMainnets(): ChainConfig[] {
		return this.getSupportedChains().filter((c) => !c.isTestnet);
	}
}

export class RpcConnection {
	private config: ChainConfig;
	private currentRpcIndex = 0;

	constructor(config: ChainConfig) {
		this.config = config;
	}

	get chainId(): number {
		return this.config.chainId;
	}

	get rpcUrl(): string {
		return this.config.rpcUrls[this.currentRpcIndex];
	}

	async call<T>(method: string, params: unknown[] = []): Promise<T> {
		const maxRetries = this.config.rpcUrls.length;
		let lastError: Error | null = null;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				return await this.executeCall<T>(method, params);
			} catch (error) {
				lastError = error as Error;
				this.rotateRpc();
			}
		}

		throw lastError ?? new Error("RPC call failed");
	}

	private async executeCall<T>(method: string, params: unknown[]): Promise<T> {
		const response = await fetch(this.rpcUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: Date.now(),
				method,
				params,
			}),
		});

		if (!response.ok) {
			throw new Error(`RPC request failed: ${response.status}`);
		}

		const data = await response.json();

		if (data.error) {
			throw new Error(data.error.message ?? "RPC error");
		}

		return data.result;
	}

	private rotateRpc(): void {
		this.currentRpcIndex =
			(this.currentRpcIndex + 1) % this.config.rpcUrls.length;
	}

	async getBlockNumber(): Promise<bigint> {
		const result = await this.call<string>("eth_blockNumber");
		return BigInt(result);
	}

	async getBalance(address: string): Promise<bigint> {
		const result = await this.call<string>("eth_getBalance", [
			address,
			"latest",
		]);
		return BigInt(result);
	}

	async getTransactionCount(address: string): Promise<bigint> {
		const result = await this.call<string>("eth_getTransactionCount", [
			address,
			"latest",
		]);
		return BigInt(result);
	}

	async getGasPrice(): Promise<bigint> {
		const result = await this.call<string>("eth_gasPrice");
		return BigInt(result);
	}

	async estimateGas(tx: {
		from?: string;
		to?: string;
		value?: string;
		data?: string;
	}): Promise<bigint> {
		const result = await this.call<string>("eth_estimateGas", [tx]);
		return BigInt(result);
	}

	async getCode(address: string): Promise<string> {
		return this.call<string>("eth_getCode", [address, "latest"]);
	}

	async sendRawTransaction(signedTx: string): Promise<string> {
		return this.call<string>("eth_sendRawTransaction", [signedTx]);
	}

	async getTransactionReceipt(
		hash: string,
	): Promise<TransactionReceipt | null> {
		return this.call<TransactionReceipt | null>("eth_getTransactionReceipt", [
			hash,
		]);
	}

	async waitForTransaction(
		hash: string,
		confirmations = 1,
		timeout = 60000,
	): Promise<TransactionReceipt> {
		const startTime = Date.now();

		while (Date.now() - startTime < timeout) {
			const receipt = await this.getTransactionReceipt(hash);
			if (receipt?.blockNumber) {
				const currentBlock = await this.getBlockNumber();
				const txBlock = BigInt(receipt.blockNumber);
				if (currentBlock - txBlock >= BigInt(confirmations - 1)) {
					return receipt;
				}
			}
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}

		throw new Error(`Transaction ${hash} not confirmed within timeout`);
	}
}

export interface TransactionReceipt {
	transactionHash: string;
	transactionIndex: string;
	blockHash: string;
	blockNumber: string;
	from: string;
	to: string | null;
	cumulativeGasUsed: string;
	gasUsed: string;
	contractAddress: string | null;
	logs: Array<{
		address: string;
		topics: string[];
		data: string;
		blockNumber: string;
		transactionHash: string;
		transactionIndex: string;
		blockHash: string;
		logIndex: string;
		removed: boolean;
	}>;
	logsBloom: string;
	status: string;
	effectiveGasPrice?: string;
	type?: string;
}

export function createChainManager(initialChainId?: number): ChainManager {
	return new ChainManager(initialChainId);
}
