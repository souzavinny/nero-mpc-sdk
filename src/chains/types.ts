export interface ChainConfig {
	chainId: number;
	chainName: string;
	displayName: string;
	nativeCurrency: {
		name: string;
		symbol: string;
		decimals: number;
	};
	rpcUrls: string[];
	blockExplorerUrls?: string[];
	iconUrl?: string;
	isTestnet: boolean;
	bundlerUrl?: string;
	paymasterUrl?: string;
	entryPointAddress?: string;
	simpleAccountFactoryAddress?: string;
}

export interface ChainNamespace {
	eip155: Map<number, ChainConfig>;
}

export type SupportedChainId = 689 | 1689 | 1 | 137 | 42161 | 8453 | 11155111;
