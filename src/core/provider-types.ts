export interface RequestArguments {
	readonly method: string;
	readonly params?: readonly unknown[] | object;
}

export interface ProviderRpcError extends Error {
	code: number;
	data?: unknown;
}

export interface ProviderConnectInfo {
	readonly chainId: string;
}

export interface EIP1193Provider {
	request(args: RequestArguments): Promise<unknown>;
	on(event: "connect", listener: (info: ProviderConnectInfo) => void): this;
	on(event: "disconnect", listener: (error: ProviderRpcError) => void): this;
	on(event: "chainChanged", listener: (chainId: string) => void): this;
	on(event: "accountsChanged", listener: (accounts: string[]) => void): this;
	on(event: "message", listener: (message: ProviderMessage) => void): this;
	on(event: string, listener: (...args: unknown[]) => void): this;
	removeListener(event: string, listener: (...args: unknown[]) => void): this;
	removeAllListeners(event?: string): this;
}

export interface ProviderMessage {
	readonly type: string;
	readonly data: unknown;
}

export interface AddEthereumChainParameter {
	chainId: string;
	chainName: string;
	nativeCurrency: {
		name: string;
		symbol: string;
		decimals: number;
	};
	rpcUrls: string[];
	blockExplorerUrls?: string[];
	iconUrls?: string[];
}

export interface WatchAssetParams {
	type: "ERC20" | "ERC721" | "ERC1155";
	options: {
		address: string;
		symbol?: string;
		decimals?: number;
		image?: string;
		tokenId?: string;
	};
}

export interface TransactionParams {
	from: string;
	to?: string;
	value?: string;
	gas?: string;
	gasPrice?: string;
	maxFeePerGas?: string;
	maxPriorityFeePerGas?: string;
	data?: string;
	nonce?: string;
}

export interface TypedDataDomain {
	name?: string;
	version?: string;
	chainId?: number | string;
	verifyingContract?: string;
	salt?: string;
}

export interface TypedDataField {
	name: string;
	type: string;
}

export type TypedDataTypes = Record<string, TypedDataField[]>;

export interface TypedDataMessage {
	[key: string]: unknown;
}

export const EIP1193_ERROR_CODES = {
	USER_REJECTED: 4001,
	UNAUTHORIZED: 4100,
	UNSUPPORTED_METHOD: 4200,
	DISCONNECTED: 4900,
	CHAIN_DISCONNECTED: 4901,
	INVALID_PARAMS: -32602,
	INTERNAL_ERROR: -32603,
	CHAIN_NOT_ADDED: 4902,
} as const;

export function createProviderRpcError(
	code: number,
	message: string,
	data?: unknown,
): ProviderRpcError {
	const error = new Error(message) as ProviderRpcError;
	error.code = code;
	error.data = data;
	return error;
}
