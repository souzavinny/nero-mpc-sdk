import type {
	FundingOptions,
	TokenBalance,
	TransactionHistoryItem,
	WalletServicesConfig,
} from "./types";

export interface WalletServicesPlugin {
	showWalletUi(): Promise<void>;
	showFunding(options?: FundingOptions): Promise<void>;
	showReceive(): Promise<void>;
	getTokenBalances(): Promise<TokenBalance[]>;
	getTransactionHistory(): Promise<TransactionHistoryItem[]>;
}

type ModalType = "wallet" | "funding" | "receive" | null;
type ModalListener = (modal: ModalType, options?: FundingOptions) => void;

export class WalletServicesPluginImpl implements WalletServicesPlugin {
	private config: WalletServicesConfig;
	private listeners: Set<ModalListener> = new Set();

	constructor(config: WalletServicesConfig) {
		this.config = config;
	}

	async showWalletUi(): Promise<void> {
		this.notifyListeners("wallet");
	}

	async showFunding(options?: FundingOptions): Promise<void> {
		this.notifyListeners("funding", options);
	}

	async showReceive(): Promise<void> {
		this.notifyListeners("receive");
	}

	async getTokenBalances(): Promise<TokenBalance[]> {
		return [];
	}

	async getTransactionHistory(): Promise<TransactionHistoryItem[]> {
		return [];
	}

	onModalOpen(listener: ModalListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notifyListeners(modal: ModalType, options?: FundingOptions): void {
		for (const listener of this.listeners) {
			listener(modal, options);
		}
	}

	getConfig(): WalletServicesConfig {
		return this.config;
	}

	updateConfig(config: Partial<WalletServicesConfig>): void {
		this.config = { ...this.config, ...config };
	}
}

export function createWalletServicesPlugin(
	config: WalletServicesConfig,
): WalletServicesPluginImpl {
	return new WalletServicesPluginImpl(config);
}
