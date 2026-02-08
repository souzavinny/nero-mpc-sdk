import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";
import type { RpcConnection } from "../chains/chain-manager";
import { SigningClient } from "../protocols/signing/signing-client";
import type { APIClient } from "../transport/api-client";
import type { KeyShare, Signature, WalletInfo } from "../types";
import { SDKError } from "../types";
import { checksumAddress, deriveEOAAddress } from "./address-derivation";

function stripHexPrefix(value: string): string {
	return value.startsWith("0x") ? value.slice(2) : value;
}

export interface UserOperation {
	sender: string;
	nonce: bigint;
	initCode: string;
	callData: string;
	callGasLimit: bigint;
	verificationGasLimit: bigint;
	preVerificationGas: bigint;
	maxFeePerGas: bigint;
	maxPriorityFeePerGas: bigint;
	paymasterAndData: string;
	signature: string;
}

export interface TransactionRequest {
	to: string;
	value?: bigint;
	data?: string;
}

export interface SmartWalletConfig {
	apiClient: APIClient;
	keyShare: KeyShare;
	partyPublicShares: Map<number, string>;
	publicKey: string;
	chainId: number;
	rpcConnection: RpcConnection;
	bundlerUrl: string;
	entryPointAddress?: string;
	factoryAddress?: string;
	paymasterUrl?: string;
}

const DEFAULT_ENTRY_POINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const DEFAULT_FACTORY = "0x9406Cc6185a346906296840746125a0E44976454";
const GET_ADDRESS_SELECTOR = "8cb84e18";

export class SmartWallet {
	private apiClient: APIClient;
	private keyShare: KeyShare;
	private partyPublicShares: Map<number, string>;
	private publicKey: string;
	private chainId: number;
	private rpcConnection: RpcConnection;
	private bundlerUrl: string;
	private entryPointAddress: string;
	private factoryAddress: string;
	private paymasterUrl?: string;

	private _eoaAddress: string;
	private _smartWalletAddress: string | null = null;
	private _isDeployed: boolean | null = null;
	private _cachedNonce: bigint | null = null;

	constructor(config: SmartWalletConfig) {
		this.apiClient = config.apiClient;
		this.keyShare = config.keyShare;
		this.partyPublicShares = config.partyPublicShares;
		this.publicKey = config.publicKey;
		this.chainId = config.chainId;
		this.rpcConnection = config.rpcConnection;
		this.bundlerUrl = config.bundlerUrl;
		this.entryPointAddress = config.entryPointAddress ?? DEFAULT_ENTRY_POINT;
		this.factoryAddress = config.factoryAddress ?? DEFAULT_FACTORY;
		this.paymasterUrl = config.paymasterUrl;

		this._eoaAddress = deriveEOAAddress(this.publicKey);
	}

	get eoaAddress(): string {
		return checksumAddress(this._eoaAddress);
	}

	/**
	 * @deprecated Use getSmartWalletAddress() instead.
	 */
	get smartWalletAddress(): string {
		if (this._smartWalletAddress) {
			return checksumAddress(this._smartWalletAddress);
		}
		throw new Error(
			"SmartWallet.smartWalletAddress is deprecated. " +
				"Use 'await wallet.getSmartWalletAddress()' instead.",
		);
	}

	async getSmartWalletAddress(): Promise<string> {
		if (this._smartWalletAddress) {
			return checksumAddress(this._smartWalletAddress);
		}

		const ownerPadded = this._eoaAddress.slice(2).padStart(64, "0");
		const saltPadded = "0".padStart(64, "0");

		const result = await this.rpcConnection.call<string>("eth_call", [
			{
				to: this.factoryAddress,
				data: `0x${GET_ADDRESS_SELECTOR}${ownerPadded}${saltPadded}`,
			},
			"latest",
		]);

		this._smartWalletAddress = `0x${result.slice(-40)}`;
		return checksumAddress(this._smartWalletAddress);
	}

	async getWalletInfo(): Promise<WalletInfo> {
		return {
			eoaAddress: this.eoaAddress,
			smartWalletAddress: await this.getSmartWalletAddress(),
			publicKey: this.publicKey,
			chainId: this.chainId,
		};
	}

	async buildUserOperation(
		transactions: TransactionRequest | TransactionRequest[],
	): Promise<UserOperation> {
		const txArray = Array.isArray(transactions) ? transactions : [transactions];

		const callData = this.encodeExecuteBatch(txArray);
		const smartWalletAddress = await this.getSmartWalletAddress();

		const nonce = await this.getNonce();

		const isDeployed = await this.isDeployed();
		const initCode = isDeployed ? "0x" : this.getInitCode();

		const feeData = await this.getFeeData();

		const userOp: UserOperation = {
			sender: smartWalletAddress,
			nonce,
			initCode,
			callData,
			callGasLimit: 200000n,
			verificationGasLimit: isDeployed ? 100000n : 400000n,
			preVerificationGas: 50000n,
			maxFeePerGas: feeData.maxFeePerGas,
			maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
			paymasterAndData: "0x",
			signature: "0x",
		};

		if (this.paymasterUrl) {
			const paymasterData = await this.getPaymasterData(userOp);
			userOp.paymasterAndData = paymasterData;
		}

		return userOp;
	}

	async signUserOperation(userOp: UserOperation): Promise<UserOperation> {
		const userOpHash = this.computeUserOpHash(userOp);

		const signingClient = new SigningClient({
			apiClient: this.apiClient,
			keyShare: this.keyShare,
			partyPublicShares: this.partyPublicShares,
		});

		const result = await signingClient.sign({
			messageHash: userOpHash,
			messageType: "transaction",
		});

		if (!result.success || !result.signature) {
			throw new SDKError(result.error ?? "Signing failed", "SIGNING_FAILED");
		}

		return {
			...userOp,
			signature: result.signature.fullSignature,
		};
	}

	async sendUserOperation(
		userOp: UserOperation,
	): Promise<{ userOpHash: string; wait: () => Promise<void> }> {
		const signedUserOp =
			userOp.signature === "0x" ? await this.signUserOperation(userOp) : userOp;

		const userOpHex = this.userOpToHex(signedUserOp);

		const response = await fetch(this.bundlerUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "eth_sendUserOperation",
				params: [userOpHex, this.entryPointAddress],
			}),
		});

		const data = await response.json();
		if (data.error) {
			throw new SDKError(
				`Bundler error: ${data.error.message}`,
				"BUNDLER_ERROR",
			);
		}

		const userOpHash = data.result as string;

		return {
			userOpHash,
			wait: async () => {
				await this.waitForUserOperationReceipt(userOpHash);
				this._isDeployed = true;
				this._cachedNonce = null;
			},
		};
	}

	private async waitForUserOperationReceipt(userOpHash: string): Promise<void> {
		const maxAttempts = 60;
		const intervalMs = 2000;

		for (let i = 0; i < maxAttempts; i++) {
			const response = await fetch(this.bundlerUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					method: "eth_getUserOperationReceipt",
					params: [userOpHash],
				}),
			});

			const data = await response.json();
			if (data.result) {
				return;
			}

			await new Promise((resolve) => setTimeout(resolve, intervalMs));
		}

		throw new SDKError("UserOperation receipt not found", "TIMEOUT");
	}

	private userOpToHex(userOp: UserOperation): Record<string, string> {
		return {
			sender: userOp.sender,
			nonce: `0x${userOp.nonce.toString(16)}`,
			initCode: userOp.initCode,
			callData: userOp.callData,
			callGasLimit: `0x${userOp.callGasLimit.toString(16)}`,
			verificationGasLimit: `0x${userOp.verificationGasLimit.toString(16)}`,
			preVerificationGas: `0x${userOp.preVerificationGas.toString(16)}`,
			maxFeePerGas: `0x${userOp.maxFeePerGas.toString(16)}`,
			maxPriorityFeePerGas: `0x${userOp.maxPriorityFeePerGas.toString(16)}`,
			paymasterAndData: userOp.paymasterAndData,
			signature: userOp.signature,
		};
	}

	async signMessage(message: string | Uint8Array): Promise<Signature> {
		const messageBytes =
			typeof message === "string" ? utf8ToBytes(message) : message;

		const prefix = utf8ToBytes(
			`\x19Ethereum Signed Message:\n${messageBytes.length}`,
		);
		const prefixedMessage = new Uint8Array(prefix.length + messageBytes.length);
		prefixedMessage.set(prefix);
		prefixedMessage.set(messageBytes, prefix.length);

		const messageHash = `0x${bytesToHex(keccak_256(prefixedMessage))}`;

		const signingClient = new SigningClient({
			apiClient: this.apiClient,
			keyShare: this.keyShare,
			partyPublicShares: this.partyPublicShares,
		});

		const result = await signingClient.sign({
			messageHash,
			messageType: "message",
		});

		if (!result.success || !result.signature) {
			throw new SDKError(
				result.error ?? "Message signing failed",
				"MESSAGE_SIGNING_FAILED",
			);
		}

		return result.signature;
	}

	async signTypedData(
		domain: Record<string, unknown>,
		types: Record<string, Array<{ name: string; type: string }>>,
		primaryType: string,
		value: Record<string, unknown>,
	): Promise<Signature> {
		const domainSeparator = this.hashTypedDataDomain(domain);
		const structHash = this.hashTypedDataStruct(types, primaryType, value);

		const messageHash = `0x${bytesToHex(
			keccak_256(
				hexToBytes(`1901${domainSeparator.slice(2)}${structHash.slice(2)}`),
			),
		)}`;

		const signingClient = new SigningClient({
			apiClient: this.apiClient,
			keyShare: this.keyShare,
			partyPublicShares: this.partyPublicShares,
		});

		const result = await signingClient.sign({
			messageHash,
			messageType: "typed_data",
		});

		if (!result.success || !result.signature) {
			throw new SDKError(
				result.error ?? "Typed data signing failed",
				"TYPED_DATA_SIGNING_FAILED",
			);
		}

		return result.signature;
	}

	private computeUserOpHash(userOp: UserOperation): string {
		const packed = this.packUserOp(userOp);
		const userOpHash = keccak_256(packed);

		const finalHash = keccak_256(
			hexToBytes(
				bytesToHex(userOpHash) +
					this.entryPointAddress.slice(2).toLowerCase().padStart(64, "0") +
					this.chainId.toString(16).padStart(64, "0"),
			),
		);

		return `0x${bytesToHex(finalHash)}`;
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

	private encodeExecuteBatch(transactions: TransactionRequest[]): string {
		if (transactions.length === 1) {
			const tx = transactions[0];
			const selector = "b61d27f6";
			const to = tx.to.slice(2).toLowerCase().padStart(64, "0");
			const value = (tx.value ?? 0n).toString(16).padStart(64, "0");
			const dataOffset = "60".padStart(64, "0");
			const data = tx.data?.slice(2) ?? "";
			const dataLength = (data.length / 2).toString(16).padStart(64, "0");

			return `0x${selector}${to}${value}${dataOffset}${dataLength}${data}`;
		}

		const n = transactions.length;

		const destArraySize = 32 + n * 32;
		const valueArraySize = 32 + n * 32;

		const destOffset = 96;
		const valueOffset = destOffset + destArraySize;
		const funcOffset = valueOffset + valueArraySize;

		let encoded = "18dfb3c7";

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

	private getInitCode(): string {
		const selector = "5fbfb9cf";
		const owner = this._eoaAddress.slice(2).toLowerCase().padStart(64, "0");
		const salt = "0".padStart(64, "0");

		return this.factoryAddress.toLowerCase() + selector + owner + salt;
	}

	private async getNonce(): Promise<bigint> {
		const isDeployed = await this.isDeployed();
		if (!isDeployed) {
			return 0n;
		}

		if (this._cachedNonce !== null) {
			return this._cachedNonce;
		}

		const smartWalletAddress = await this.getSmartWalletAddress();
		const nonceKey = 0n;
		const nonceData = await this.rpcConnection.call<string>("eth_call", [
			{
				to: this.entryPointAddress,
				data: `0x35567e1a${smartWalletAddress.slice(2).padStart(64, "0")}${nonceKey.toString(16).padStart(64, "0")}`,
			},
			"latest",
		]);

		const nonce = BigInt(nonceData);
		this._cachedNonce = nonce;
		return nonce;
	}

	private async isDeployed(): Promise<boolean> {
		if (this._isDeployed !== null) {
			return this._isDeployed;
		}

		try {
			const smartWalletAddress = await this.getSmartWalletAddress();
			const code = await this.rpcConnection.getCode(smartWalletAddress);
			this._isDeployed = code !== "0x" && code.length > 2;
			return this._isDeployed;
		} catch {
			return false;
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

	private async getPaymasterData(userOp: UserOperation): Promise<string> {
		if (!this.paymasterUrl) {
			return "0x";
		}

		try {
			const userOpHex = this.userOpToHex(userOp);
			const response = await fetch(this.paymasterUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					method: "pm_sponsorUserOperation",
					params: [userOpHex, this.entryPointAddress, {}],
				}),
			});

			const data = await response.json();
			if (data.error || !data.result?.paymasterAndData) {
				return "0x";
			}

			return data.result.paymasterAndData;
		} catch {
			return "0x";
		}
	}

	private hashTypedDataDomain(domain: Record<string, unknown>): string {
		const domainFields: Array<{ name: string; type: string }> = [];
		let domainValues = "";

		if (domain.name !== undefined) {
			domainFields.push({ name: "name", type: "string" });
			domainValues += bytesToHex(
				keccak_256(utf8ToBytes(domain.name as string)),
			);
		}
		if (domain.version !== undefined) {
			domainFields.push({ name: "version", type: "string" });
			domainValues += bytesToHex(
				keccak_256(utf8ToBytes(domain.version as string)),
			);
		}
		if (domain.chainId !== undefined) {
			domainFields.push({ name: "chainId", type: "uint256" });
			domainValues += BigInt(domain.chainId as number)
				.toString(16)
				.padStart(64, "0");
		}
		if (domain.verifyingContract !== undefined) {
			domainFields.push({ name: "verifyingContract", type: "address" });
			domainValues += stripHexPrefix(domain.verifyingContract as string)
				.toLowerCase()
				.padStart(64, "0");
		}
		if (domain.salt !== undefined) {
			domainFields.push({ name: "salt", type: "bytes32" });
			domainValues += stripHexPrefix(domain.salt as string).padStart(64, "0");
		}

		const domainTypeString = this.formatType("EIP712Domain", domainFields);
		const domainTypeHash = `0x${bytesToHex(keccak_256(utf8ToBytes(domainTypeString)))}`;
		return `0x${bytesToHex(keccak_256(hexToBytes(domainTypeHash.slice(2) + domainValues)))}`;
	}

	private hashTypedDataStruct(
		types: Record<string, Array<{ name: string; type: string }>>,
		primaryType: string,
		value: Record<string, unknown>,
	): string {
		return this.hashStruct(primaryType, types, value);
	}

	private encodeType(
		typeName: string,
		types: Record<string, Array<{ name: string; type: string }>>,
	): string {
		const fields = types[typeName];
		if (!fields) {
			throw new SDKError(`Unknown type: ${typeName}`, "INVALID_TYPE");
		}

		const deps = this.findTypeDependencies(typeName, types, new Set());
		deps.delete(typeName);

		const sortedDeps = Array.from(deps).sort();

		let result = this.formatType(typeName, fields);
		for (const dep of sortedDeps) {
			result += this.formatType(dep, types[dep]);
		}

		return result;
	}

	private formatType(
		typeName: string,
		fields: Array<{ name: string; type: string }>,
	): string {
		return `${typeName}(${fields.map((f) => `${f.type} ${f.name}`).join(",")})`;
	}

	private findTypeDependencies(
		typeName: string,
		types: Record<string, Array<{ name: string; type: string }>>,
		found: Set<string>,
	): Set<string> {
		if (found.has(typeName)) return found;

		const fields = types[typeName];
		if (!fields) return found;

		found.add(typeName);

		for (const field of fields) {
			let baseType = field.type;
			if (baseType.endsWith("[]")) {
				baseType = baseType.slice(0, -2);
			}
			if (types[baseType]) {
				this.findTypeDependencies(baseType, types, found);
			}
		}

		return found;
	}

	private hashType(
		typeName: string,
		types: Record<string, Array<{ name: string; type: string }>>,
	): string {
		const encodedType = this.encodeType(typeName, types);
		return `0x${bytesToHex(keccak_256(utf8ToBytes(encodedType)))}`;
	}

	private hashStruct(
		typeName: string,
		types: Record<string, Array<{ name: string; type: string }>>,
		value: Record<string, unknown>,
	): string {
		const fields = types[typeName];
		if (!fields) {
			throw new SDKError(`Unknown type: ${typeName}`, "INVALID_TYPE");
		}

		const typeHash = this.hashType(typeName, types);
		let encodedValues = "";

		for (const field of fields) {
			const fieldValue = value[field.name];
			encodedValues += this.encodeField(field.type, fieldValue, types);
		}

		return `0x${bytesToHex(keccak_256(hexToBytes(typeHash.slice(2) + encodedValues)))}`;
	}

	private encodeField(
		type: string,
		value: unknown,
		types: Record<string, Array<{ name: string; type: string }>>,
	): string {
		if (type === "string") {
			return bytesToHex(keccak_256(utf8ToBytes(value as string)));
		}
		if (type === "bytes") {
			const bytesValue = stripHexPrefix(value as string);
			return bytesToHex(keccak_256(hexToBytes(bytesValue)));
		}
		if (type === "bool") {
			return (value ? 1n : 0n).toString(16).padStart(64, "0");
		}
		if (type === "address") {
			return stripHexPrefix(value as string)
				.toLowerCase()
				.padStart(64, "0");
		}
		if (type.startsWith("uint") || type.startsWith("int")) {
			const n = BigInt(value as number | string);
			if (type.startsWith("int") && n < 0n) {
				return ((1n << 256n) + n).toString(16).padStart(64, "0");
			}
			return n.toString(16).padStart(64, "0");
		}
		if (type.startsWith("bytes")) {
			const bytesValue = stripHexPrefix(value as string);
			return bytesValue.padEnd(64, "0");
		}
		if (types[type]) {
			return this.hashStruct(
				type,
				types,
				value as Record<string, unknown>,
			).slice(2);
		}
		if (type.endsWith("[]")) {
			const arrayType = type.slice(0, -2);
			const arrayValue = value as unknown[];
			const encodedItems = arrayValue.map((item) =>
				this.encodeField(arrayType, item, types),
			);
			return bytesToHex(keccak_256(hexToBytes(encodedItems.join(""))));
		}
		throw new SDKError(`Unsupported type: ${type}`, "UNSUPPORTED_TYPE");
	}
}

export function createSmartWallet(config: SmartWalletConfig): SmartWallet {
	return new SmartWallet(config);
}
