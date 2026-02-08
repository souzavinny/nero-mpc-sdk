import type {
	GasEstimate,
	UserOperation,
	UserOperationHex,
	UserOperationReceipt,
} from "./types";
import { userOpToHex } from "./types";

export interface BundlerClientConfig {
	bundlerUrl: string;
	entryPointAddress: string;
	chainId: number;
}

interface JsonRpcResponse<T> {
	jsonrpc: string;
	id: number;
	result?: T;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}

export class BundlerClient {
	private bundlerUrl: string;
	private entryPointAddress: string;
	private requestId = 0;

	constructor(config: BundlerClientConfig) {
		this.bundlerUrl = config.bundlerUrl;
		this.entryPointAddress = config.entryPointAddress;
	}

	async sendUserOperation(userOp: UserOperation): Promise<string> {
		const userOpHex = userOpToHex(userOp);
		return this.call<string>("eth_sendUserOperation", [
			userOpHex,
			this.entryPointAddress,
		]);
	}

	async estimateUserOperationGas(
		userOp: Partial<UserOperation>,
	): Promise<GasEstimate> {
		const partialOpHex: Partial<UserOperationHex> = {};

		if (userOp.sender) partialOpHex.sender = userOp.sender;
		if (userOp.nonce !== undefined)
			partialOpHex.nonce = `0x${userOp.nonce.toString(16)}`;
		if (userOp.initCode) partialOpHex.initCode = userOp.initCode;
		if (userOp.callData) partialOpHex.callData = userOp.callData;
		if (userOp.callGasLimit !== undefined)
			partialOpHex.callGasLimit = `0x${userOp.callGasLimit.toString(16)}`;
		if (userOp.verificationGasLimit !== undefined)
			partialOpHex.verificationGasLimit = `0x${userOp.verificationGasLimit.toString(16)}`;
		if (userOp.preVerificationGas !== undefined)
			partialOpHex.preVerificationGas = `0x${userOp.preVerificationGas.toString(16)}`;
		if (userOp.maxFeePerGas !== undefined)
			partialOpHex.maxFeePerGas = `0x${userOp.maxFeePerGas.toString(16)}`;
		if (userOp.maxPriorityFeePerGas !== undefined)
			partialOpHex.maxPriorityFeePerGas = `0x${userOp.maxPriorityFeePerGas.toString(16)}`;
		if (userOp.paymasterAndData)
			partialOpHex.paymasterAndData = userOp.paymasterAndData;
		if (userOp.signature) partialOpHex.signature = userOp.signature;

		const result = await this.call<{
			preVerificationGas: string;
			verificationGasLimit: string;
			callGasLimit: string;
		}>("eth_estimateUserOperationGas", [partialOpHex, this.entryPointAddress]);

		return {
			preVerificationGas: BigInt(result.preVerificationGas),
			verificationGasLimit: BigInt(result.verificationGasLimit),
			callGasLimit: BigInt(result.callGasLimit),
		};
	}

	async getUserOperationByHash(
		hash: string,
	): Promise<UserOperationReceipt | null> {
		try {
			return await this.call<UserOperationReceipt | null>(
				"eth_getUserOperationByHash",
				[hash],
			);
		} catch {
			return null;
		}
	}

	async getUserOperationReceipt(
		hash: string,
	): Promise<UserOperationReceipt | null> {
		try {
			return await this.call<UserOperationReceipt | null>(
				"eth_getUserOperationReceipt",
				[hash],
			);
		} catch {
			return null;
		}
	}

	async getSupportedEntryPoints(): Promise<string[]> {
		return this.call<string[]>("eth_supportedEntryPoints", []);
	}

	async getChainId(): Promise<number> {
		const result = await this.call<string>("eth_chainId", []);
		return Number.parseInt(result, 16);
	}

	async waitForUserOperationReceipt(
		hash: string,
		timeout = 60000,
		interval = 2000,
	): Promise<UserOperationReceipt> {
		const startTime = Date.now();

		while (Date.now() - startTime < timeout) {
			const receipt = await this.getUserOperationReceipt(hash);
			if (receipt) {
				return receipt;
			}
			await new Promise((resolve) => setTimeout(resolve, interval));
		}

		throw new Error(`UserOperation ${hash} not confirmed within timeout`);
	}

	private async call<T>(method: string, params: unknown[]): Promise<T> {
		const response = await fetch(this.bundlerUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: ++this.requestId,
				method,
				params,
			}),
		});

		if (!response.ok) {
			throw new Error(`Bundler request failed: ${response.status}`);
		}

		const data: JsonRpcResponse<T> = await response.json();

		if (data.error) {
			throw new Error(
				`Bundler error: ${data.error.message} (code: ${data.error.code})`,
			);
		}

		return data.result as T;
	}
}

export function createBundlerClient(
	config: BundlerClientConfig,
): BundlerClient {
	return new BundlerClient(config);
}
