import type {
	PaymasterContext,
	PaymasterResult,
	UserOperation,
	UserOperationHex,
} from "./types";
import { userOpToHex } from "./types";

export interface PaymasterClientConfig {
	paymasterUrl: string;
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

interface SponsorUserOperationResult {
	paymasterAndData: string;
	preVerificationGas?: string;
	verificationGasLimit?: string;
	callGasLimit?: string;
}

export class PaymasterClient {
	private paymasterUrl: string;
	private entryPointAddress: string;
	private chainId: number;
	private requestId = 0;

	constructor(config: PaymasterClientConfig) {
		this.paymasterUrl = config.paymasterUrl;
		this.entryPointAddress = config.entryPointAddress;
		this.chainId = config.chainId;
	}

	async getPaymasterData(
		userOp: Partial<UserOperation>,
		context?: PaymasterContext,
	): Promise<PaymasterResult> {
		const partialOpHex = this.partialUserOpToHex(userOp);

		const result = await this.call<SponsorUserOperationResult>(
			"pm_sponsorUserOperation",
			[partialOpHex, this.entryPointAddress, context ?? {}],
		);

		return {
			paymasterAndData: result.paymasterAndData,
			preVerificationGas: result.preVerificationGas
				? BigInt(result.preVerificationGas)
				: undefined,
			verificationGasLimit: result.verificationGasLimit
				? BigInt(result.verificationGasLimit)
				: undefined,
			callGasLimit: result.callGasLimit
				? BigInt(result.callGasLimit)
				: undefined,
		};
	}

	async validatePaymasterUserOp(
		userOp: UserOperation,
	): Promise<{ valid: boolean; validAfter?: bigint; validUntil?: bigint }> {
		const userOpHex = userOpToHex(userOp);

		try {
			const result = await this.call<{
				valid: boolean;
				validAfter?: string;
				validUntil?: string;
			}>("pm_validatePaymasterUserOp", [userOpHex, this.entryPointAddress]);

			return {
				valid: result.valid,
				validAfter: result.validAfter ? BigInt(result.validAfter) : undefined,
				validUntil: result.validUntil ? BigInt(result.validUntil) : undefined,
			};
		} catch {
			return { valid: false };
		}
	}

	async getSupportedTokens(): Promise<
		Array<{ address: string; symbol: string; decimals: number }>
	> {
		try {
			return await this.call<
				Array<{ address: string; symbol: string; decimals: number }>
			>("pm_supportedTokens", [this.chainId.toString()]);
		} catch {
			return [];
		}
	}

	async getTokenPaymasterData(
		userOp: Partial<UserOperation>,
		tokenAddress: string,
	): Promise<PaymasterResult> {
		return this.getPaymasterData(userOp, {
			mode: "erc20",
			token: tokenAddress,
		});
	}

	private partialUserOpToHex(
		userOp: Partial<UserOperation>,
	): Partial<UserOperationHex> {
		const result: Partial<UserOperationHex> = {};

		if (userOp.sender) result.sender = userOp.sender;
		if (userOp.nonce !== undefined)
			result.nonce = `0x${userOp.nonce.toString(16)}`;
		if (userOp.initCode) result.initCode = userOp.initCode;
		if (userOp.callData) result.callData = userOp.callData;
		if (userOp.callGasLimit !== undefined)
			result.callGasLimit = `0x${userOp.callGasLimit.toString(16)}`;
		if (userOp.verificationGasLimit !== undefined)
			result.verificationGasLimit = `0x${userOp.verificationGasLimit.toString(16)}`;
		if (userOp.preVerificationGas !== undefined)
			result.preVerificationGas = `0x${userOp.preVerificationGas.toString(16)}`;
		if (userOp.maxFeePerGas !== undefined)
			result.maxFeePerGas = `0x${userOp.maxFeePerGas.toString(16)}`;
		if (userOp.maxPriorityFeePerGas !== undefined)
			result.maxPriorityFeePerGas = `0x${userOp.maxPriorityFeePerGas.toString(16)}`;
		if (userOp.paymasterAndData)
			result.paymasterAndData = userOp.paymasterAndData;
		if (userOp.signature) result.signature = userOp.signature;

		return result;
	}

	private async call<T>(method: string, params: unknown[]): Promise<T> {
		const response = await fetch(this.paymasterUrl, {
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
			throw new Error(`Paymaster request failed: ${response.status}`);
		}

		const data: JsonRpcResponse<T> = await response.json();

		if (data.error) {
			throw new Error(
				`Paymaster error: ${data.error.message} (code: ${data.error.code})`,
			);
		}

		return data.result as T;
	}
}

export function createPaymasterClient(
	config: PaymasterClientConfig,
): PaymasterClient {
	return new PaymasterClient(config);
}
