import type { ChainConfig } from "./types";

export const NERO_TESTNET: ChainConfig = {
	chainId: 689,
	chainName: "nero-testnet",
	displayName: "NERO Testnet",
	nativeCurrency: {
		name: "NERO",
		symbol: "NERO",
		decimals: 18,
	},
	rpcUrls: ["https://testnet.nerochain.io"],
	blockExplorerUrls: ["https://testnetscan.nerochain.io"],
	isTestnet: true,
	bundlerUrl: "https://bundler.testnet.nerochain.io",
	paymasterUrl: "https://paymaster.testnet.nerochain.io",
	entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
	simpleAccountFactoryAddress: "0x9406Cc6185a346906296840746125a0E44976454",
};

export const NERO_MAINNET: ChainConfig = {
	chainId: 1689,
	chainName: "nero-mainnet",
	displayName: "NERO Mainnet",
	nativeCurrency: {
		name: "NERO",
		symbol: "NERO",
		decimals: 18,
	},
	rpcUrls: ["https://rpc.nerochain.io"],
	blockExplorerUrls: ["https://scan.nerochain.io"],
	isTestnet: false,
	bundlerUrl: "https://bundler.nerochain.io",
	paymasterUrl: "https://paymaster.nerochain.io",
	entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
	simpleAccountFactoryAddress: "0x9406Cc6185a346906296840746125a0E44976454",
};

export const ETHEREUM_MAINNET: ChainConfig = {
	chainId: 1,
	chainName: "ethereum",
	displayName: "Ethereum",
	nativeCurrency: {
		name: "Ether",
		symbol: "ETH",
		decimals: 18,
	},
	rpcUrls: ["https://eth.llamarpc.com", "https://rpc.ankr.com/eth"],
	blockExplorerUrls: ["https://etherscan.io"],
	isTestnet: false,
	entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
};

export const ETHEREUM_SEPOLIA: ChainConfig = {
	chainId: 11155111,
	chainName: "sepolia",
	displayName: "Sepolia Testnet",
	nativeCurrency: {
		name: "Sepolia Ether",
		symbol: "ETH",
		decimals: 18,
	},
	rpcUrls: ["https://rpc.sepolia.org", "https://rpc.ankr.com/eth_sepolia"],
	blockExplorerUrls: ["https://sepolia.etherscan.io"],
	isTestnet: true,
	entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
};

export const POLYGON_MAINNET: ChainConfig = {
	chainId: 137,
	chainName: "polygon",
	displayName: "Polygon",
	nativeCurrency: {
		name: "MATIC",
		symbol: "MATIC",
		decimals: 18,
	},
	rpcUrls: ["https://polygon-rpc.com", "https://rpc.ankr.com/polygon"],
	blockExplorerUrls: ["https://polygonscan.com"],
	isTestnet: false,
	entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
};

export const ARBITRUM_ONE: ChainConfig = {
	chainId: 42161,
	chainName: "arbitrum",
	displayName: "Arbitrum One",
	nativeCurrency: {
		name: "Ether",
		symbol: "ETH",
		decimals: 18,
	},
	rpcUrls: ["https://arb1.arbitrum.io/rpc", "https://rpc.ankr.com/arbitrum"],
	blockExplorerUrls: ["https://arbiscan.io"],
	isTestnet: false,
	entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
};

export const BASE_MAINNET: ChainConfig = {
	chainId: 8453,
	chainName: "base",
	displayName: "Base",
	nativeCurrency: {
		name: "Ether",
		symbol: "ETH",
		decimals: 18,
	},
	rpcUrls: ["https://mainnet.base.org", "https://base.llamarpc.com"],
	blockExplorerUrls: ["https://basescan.org"],
	isTestnet: false,
	entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
};

export const BUILTIN_CHAINS: Map<number, ChainConfig> = new Map([
	[NERO_TESTNET.chainId, NERO_TESTNET],
	[NERO_MAINNET.chainId, NERO_MAINNET],
	[ETHEREUM_MAINNET.chainId, ETHEREUM_MAINNET],
	[ETHEREUM_SEPOLIA.chainId, ETHEREUM_SEPOLIA],
	[POLYGON_MAINNET.chainId, POLYGON_MAINNET],
	[ARBITRUM_ONE.chainId, ARBITRUM_ONE],
	[BASE_MAINNET.chainId, BASE_MAINNET],
]);

export function getChainConfig(chainId: number): ChainConfig | undefined {
	return BUILTIN_CHAINS.get(chainId);
}

export function getAllChains(): ChainConfig[] {
	return Array.from(BUILTIN_CHAINS.values());
}

export function getTestnetChains(): ChainConfig[] {
	return getAllChains().filter((c) => c.isTestnet);
}

export function getMainnetChains(): ChainConfig[] {
	return getAllChains().filter((c) => !c.isTestnet);
}
