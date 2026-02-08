export interface WalletServicesConfig {
	chainId: number;
	walletAddress: string;
	explorerUrl?: string;
	fundingProviders?: FundingProvider[];
}

export interface FundingProvider {
	id: string;
	name: string;
	logoUrl?: string;
	url: string;
	supportedChains: number[];
}

export interface FundingOptions {
	amount?: string;
	token?: string;
	provider?: string;
}

export interface TransactionHistoryItem {
	hash: string;
	from: string;
	to: string;
	value: string;
	timestamp: number;
	status: "pending" | "confirmed" | "failed";
	type: "send" | "receive" | "contract";
}

export interface TokenBalance {
	address: string;
	symbol: string;
	name: string;
	decimals: number;
	balance: string;
	logoUrl?: string;
	valueUsd?: string;
}
