import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import type { RpcConnection } from "../chains/chain-manager";
import { BundlerClient } from "./bundler-client";
import { PaymasterClient } from "./paymaster-client";
import type { GasEstimate, UserOperation } from "./types";
import type { PaymasterContext } from "./types";

export interface SimpleAccountConfig {
	ownerAddress: string;
	factoryAddress: string;
	entryPointAddress: string;
	bundlerUrl: string;
	paymasterUrl?: string;
	chainId: number;
	salt?: bigint;
	rpcConnection: RpcConnection;
}

export interface TransactionRequest {
	to: string;
	value?: bigint;
	data?: string;
}

const EXECUTE_SELECTOR = "b61d27f6";
const EXECUTE_BATCH_SELECTOR = "18dfb3c7";
const CREATE_ACCOUNT_SELECTOR = "5fbfb9cf";
const GET_ADDRESS_SELECTOR = "8cb84e18";

export class SimpleAccount {
	private ownerAddress: string;
	private factoryAddress: string;
	private entryPointAddress: string;
	private salt: bigint;
	private bundlerClient: BundlerClient;
	private paymasterClient: PaymasterClient | null;
	private chainId: number;
	private rpcConnection: RpcConnection;

	private _accountAddress: string | null = null;
	private _isDeployed: boolean | null = null;
	private _cachedNonce: bigint | null = null;

	constructor(config: SimpleAccountConfig) {
		this.ownerAddress = config.ownerAddress.toLowerCase();
		this.factoryAddress = config.factoryAddress.toLowerCase();
		this.entryPointAddress = config.entryPointAddress.toLowerCase();
		this.salt = config.salt ?? 0n;
		this.chainId = config.chainId;
		this.rpcConnection = config.rpcConnection;

		this.bundlerClient = new BundlerClient({
			bundlerUrl: config.bundlerUrl,
			entryPointAddress: config.entryPointAddress,
			chainId: config.chainId,
		});

		this.paymasterClient = config.paymasterUrl
			? new PaymasterClient({
					paymasterUrl: config.paymasterUrl,
					entryPointAddress: config.entryPointAddress,
					chainId: config.chainId,
				})
			: null;
	}

	/**
	 * @deprecated Use getAccountAddress() instead. This sync getter is removed
	 * because address derivation now requires an RPC call to the factory.
	 */
	get accountAddress(): string {
		if (this._accountAddress) {
			return this._accountAddress;
		}
		throw new Error(
			"SimpleAccount.accountAddress is deprecated. " +
				"Use 'await account.getAccountAddress()' instead. " +
				"Address derivation now requires an RPC call to factory.getAddress().",
		);
	}

	async getAccountAddress(): Promise<string> {
		if (this._accountAddress) {
			return this._accountAddress;
		}

		this._accountAddress = await this.fetchAccountAddressFromFactory();
		return this._accountAddress;
	}

	async isDeployed(): Promise<boolean> {
		if (this._isDeployed !== null) {
			return this._isDeployed;
		}

		try {
			const code = await this.getAccountCode();
			this._isDeployed = code !== "0x" && code.length > 2;
			return this._isDeployed;
		} catch {
			return false;
		}
	}

	invalidateDeploymentCache(): void {
		this._isDeployed = null;
	}

	async buildUserOperation(
		transactions: TransactionRequest | TransactionRequest[],
		options?: {
			usePaymaster?: boolean;
			paymasterContext?: PaymasterContext;
		},
	): Promise<UserOperation> {
		const txArray = Array.isArray(transactions) ? transactions : [transactions];
		const callData = this.encodeExecute(txArray);

		const accountAddress = await this.getAccountAddress();
		const isDeployed = await this.isDeployed();
		const initCode = isDeployed ? "0x" : this.getInitCode();

		const nonce = await this.getNonce();

		let userOp: UserOperation = {
			sender: accountAddress,
			nonce,
			initCode,
			callData,
			callGasLimit: 0n,
			verificationGasLimit: 0n,
			preVerificationGas: 0n,
			maxFeePerGas: 0n,
			maxPriorityFeePerGas: 0n,
			paymasterAndData: "0x",
			signature: this.getDummySignature(),
		};

		const gasEstimate = await this.estimateGas(userOp);
		const feeData = await this.getFeeData();

		userOp = {
			...userOp,
			callGasLimit: gasEstimate.callGasLimit,
			verificationGasLimit: gasEstimate.verificationGasLimit,
			preVerificationGas: gasEstimate.preVerificationGas,
			maxFeePerGas: feeData.maxFeePerGas,
			maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
		};

		if (options?.usePaymaster && this.paymasterClient) {
			const paymasterData = await this.paymasterClient.getPaymasterData(
				userOp,
				options.paymasterContext,
			);
			userOp.paymasterAndData = paymasterData.paymasterAndData;

			if (paymasterData.preVerificationGas) {
				userOp.preVerificationGas = paymasterData.preVerificationGas;
			}
			if (paymasterData.verificationGasLimit) {
				userOp.verificationGasLimit = paymasterData.verificationGasLimit;
			}
			if (paymasterData.callGasLimit) {
				userOp.callGasLimit = paymasterData.callGasLimit;
			}
		}

		userOp.signature = "0x";

		return userOp;
	}

	computeUserOpHash(userOp: UserOperation): string {
		const packed = this.packUserOp(userOp);
		const userOpHash = keccak_256(packed);

		const finalHash = keccak_256(
			hexToBytes(
				bytesToHex(userOpHash) +
					this.entryPointAddress.slice(2).padStart(64, "0") +
					this.chainId.toString(16).padStart(64, "0"),
			),
		);

		return `0x${bytesToHex(finalHash)}`;
	}

	async sendUserOperation(
		userOp: UserOperation,
	): Promise<{ userOpHash: string; wait: () => Promise<void> }> {
		const userOpHash = await this.bundlerClient.sendUserOperation(userOp);

		return {
			userOpHash,
			wait: async () => {
				await this.bundlerClient.waitForUserOperationReceipt(userOpHash);
				this._isDeployed = true;
				this.invalidateNonceCache();
			},
		};
	}

	private async fetchAccountAddressFromFactory(): Promise<string> {
		const ownerPadded = this.ownerAddress.slice(2).padStart(64, "0");
		const saltPadded = this.salt.toString(16).padStart(64, "0");

		const result = await this.rpcConnection.call<string>("eth_call", [
			{
				to: this.factoryAddress,
				data: `0x${GET_ADDRESS_SELECTOR}${ownerPadded}${saltPadded}`,
			},
			"latest",
		]);

		return `0x${result.slice(-40)}`;
	}

	private getInitCode(): string {
		const ownerPadded = this.ownerAddress.slice(2).padStart(64, "0");
		const saltPadded = this.salt.toString(16).padStart(64, "0");

		return (
			this.factoryAddress + CREATE_ACCOUNT_SELECTOR + ownerPadded + saltPadded
		);
	}

	private encodeExecute(transactions: TransactionRequest[]): string {
		if (transactions.length === 1) {
			const tx = transactions[0];
			const to = tx.to.slice(2).toLowerCase().padStart(64, "0");
			const value = (tx.value ?? 0n).toString(16).padStart(64, "0");
			const dataOffset = "60".padStart(64, "0");
			const data = tx.data?.slice(2) ?? "";
			const dataLength = (data.length / 2).toString(16).padStart(64, "0");

			return `0x${EXECUTE_SELECTOR}${to}${value}${dataOffset}${dataLength}${data}`;
		}

		const n = transactions.length;

		const destArraySize = 32 + n * 32;
		const valueArraySize = 32 + n * 32;

		const destOffset = 96;
		const valueOffset = destOffset + destArraySize;
		const funcOffset = valueOffset + valueArraySize;

		let encoded = EXECUTE_BATCH_SELECTOR;

		encoded += destOffset.toString(16).padStart(64, "0");
		encoded += valueOffset.toString(16).padStart(64, "0");
		encoded += funcOffset.toString(16).padStart(64, "0");

		encoded += n.toString(16).padStart(64, "0");
		for (const tx of transactions) {
			encoded += tx.to.slice(2).toLowerCase().padStart(64, "0");
		}

		encoded += n.toString(16).padStart(64, "0");
		for (const tx of transactions) {
			encoded += (tx.value ?? 0n).toString(16).padStart(64, "0");
		}

		const funcDatas: string[] = transactions.map((tx) => {
			const data = tx.data ?? "0x";
			return data.startsWith("0x") ? data.slice(2) : data;
		});

		const funcElementOffsets: number[] = [];
		let currentOffset = 32 + n * 32;
		for (const funcData of funcDatas) {
			funcElementOffsets.push(currentOffset);
			const dataLen = funcData.length / 2;
			const paddedLen = Math.ceil(dataLen / 32) * 32;
			currentOffset += 32 + paddedLen;
		}

		encoded += n.toString(16).padStart(64, "0");
		for (const offset of funcElementOffsets) {
			encoded += offset.toString(16).padStart(64, "0");
		}

		for (const funcData of funcDatas) {
			const dataLen = funcData.length / 2;
			encoded += dataLen.toString(16).padStart(64, "0");
			if (funcData.length > 0) {
				const paddedLen = Math.ceil(dataLen / 32) * 32;
				encoded += funcData.padEnd(paddedLen * 2, "0");
			}
		}

		return `0x${encoded}`;
	}

	private packUserOp(userOp: UserOperation): Uint8Array {
		const initCodeHash = keccak_256(hexToBytes(userOp.initCode.slice(2) || ""));
		const callDataHash = keccak_256(hexToBytes(userOp.callData.slice(2) || ""));
		const paymasterAndDataHash = keccak_256(
			hexToBytes(userOp.paymasterAndData.slice(2) || ""),
		);

		const packed =
			userOp.sender.slice(2).toLowerCase().padStart(64, "0") +
			userOp.nonce.toString(16).padStart(64, "0") +
			bytesToHex(initCodeHash) +
			bytesToHex(callDataHash) +
			userOp.callGasLimit.toString(16).padStart(64, "0") +
			userOp.verificationGasLimit.toString(16).padStart(64, "0") +
			userOp.preVerificationGas.toString(16).padStart(64, "0") +
			userOp.maxFeePerGas.toString(16).padStart(64, "0") +
			userOp.maxPriorityFeePerGas.toString(16).padStart(64, "0") +
			bytesToHex(paymasterAndDataHash);

		return hexToBytes(packed);
	}

	private getDummySignature(): string {
		return `0x${"00".repeat(65)}`;
	}

	private async getNonce(): Promise<bigint> {
		const isDeployed = await this.isDeployed();
		if (!isDeployed) {
			return 0n;
		}

		if (this._cachedNonce !== null) {
			return this._cachedNonce;
		}

		const accountAddress = await this.getAccountAddress();
		const nonceKey = 0n;
		const nonceData = await this.rpcConnection.call<string>("eth_call", [
			{
				to: this.entryPointAddress,
				data: `0x35567e1a${accountAddress.slice(2).padStart(64, "0")}${nonceKey.toString(16).padStart(64, "0")}`,
			},
			"latest",
		]);

		const nonce = BigInt(nonceData);
		this._cachedNonce = nonce;
		return nonce;
	}

	invalidateNonceCache(): void {
		this._cachedNonce = null;
	}

	private async estimateGas(userOp: UserOperation): Promise<GasEstimate> {
		try {
			return await this.bundlerClient.estimateUserOperationGas(userOp);
		} catch {
			const isDeployed = await this.isDeployed();
			return {
				preVerificationGas: 50000n,
				verificationGasLimit: isDeployed ? 100000n : 400000n,
				callGasLimit: 200000n,
			};
		}
	}

	private async getFeeData(): Promise<{
		maxFeePerGas: bigint;
		maxPriorityFeePerGas: bigint;
	}> {
		try {
			const gasPrice = await this.rpcConnection.getGasPrice();
			return {
				maxFeePerGas: gasPrice * 2n,
				maxPriorityFeePerGas: gasPrice / 10n,
			};
		} catch {
			return {
				maxFeePerGas: 1000000000n,
				maxPriorityFeePerGas: 1000000000n,
			};
		}
	}

	private async getAccountCode(): Promise<string> {
		const accountAddress = await this.getAccountAddress();
		return this.rpcConnection.getCode(accountAddress);
	}
}

export function createSimpleAccount(
	config: SimpleAccountConfig,
): SimpleAccount {
	return new SimpleAccount(config);
}
