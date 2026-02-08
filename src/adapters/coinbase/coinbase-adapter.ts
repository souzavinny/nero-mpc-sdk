import type { EIP1193Provider } from "../../core/provider-types";
import { type AdapterConfig, BaseWalletAdapter } from "../base-adapter";

export interface CoinbaseConfig extends AdapterConfig {
	appName: string;
	appLogoUrl?: string;
	darkMode?: boolean;
}

export class CoinbaseAdapter extends BaseWalletAdapter {
	readonly name = "Coinbase Wallet";
	readonly icon = "https://www.coinbase.com/img/favicon/favicon-256.png";
	readonly url = "https://www.coinbase.com/wallet";

	private coinbaseWallet: any = null;

	async connect(config?: CoinbaseConfig): Promise<string[]> {
		if (!config?.appName) {
			throw new Error("Coinbase appName is required");
		}

		this.setStatus("connecting");

		try {
			const CoinbaseWalletSDK = await this.loadCoinbaseSDK();

			this.coinbaseWallet = new CoinbaseWalletSDK({
				appName: config.appName,
				appLogoUrl: config.appLogoUrl,
				darkMode: config.darkMode,
			});

			const provider = this.coinbaseWallet.makeWeb3Provider();

			const accounts = (await provider.request({
				method: "eth_requestAccounts",
			})) as string[];

			const chainIdHex = (await provider.request({
				method: "eth_chainId",
			})) as string;
			const chainId = Number.parseInt(chainIdHex, 16);

			this._provider = provider as EIP1193Provider;

			this.setupEventListeners(provider);
			this.handleConnect(chainId, accounts);

			return accounts;
		} catch (error) {
			this.handleError(error as Error);
			throw error;
		}
	}

	async disconnect(): Promise<void> {
		if (this.coinbaseWallet) {
			try {
				await this.coinbaseWallet.disconnect();
			} catch {
				// Ignore disconnect errors
			}
			this.coinbaseWallet = null;
		}
		this.handleDisconnect();
	}

	async switchChain(chainId: number): Promise<void> {
		if (!this._provider) {
			throw new Error("Not connected");
		}

		try {
			await this._provider.request({
				method: "wallet_switchEthereumChain",
				params: [{ chainId: `0x${chainId.toString(16)}` }],
			});
		} catch (error: any) {
			if (error.code === 4902) {
				throw new Error(`Chain ${chainId} not supported by Coinbase Wallet`);
			}
			throw error;
		}
	}

	private async loadCoinbaseSDK(): Promise<any> {
		try {
			// @ts-expect-error - Optional peer dependency
			const module = await import("@coinbase/wallet-sdk");
			return module.default || module.CoinbaseWalletSDK;
		} catch {
			throw new Error(
				"Coinbase Wallet SDK not installed. " +
					"Please install @coinbase/wallet-sdk",
			);
		}
	}

	private setupEventListeners(provider: any): void {
		provider.on("accountsChanged", (accounts: string[]) => {
			this.setAccounts(accounts);
			if (accounts.length === 0) {
				this.handleDisconnect();
			}
		});

		provider.on("chainChanged", (chainId: string | number) => {
			const numericChainId =
				typeof chainId === "string" ? Number.parseInt(chainId, 16) : chainId;
			this.setChainId(numericChainId);
		});

		provider.on("disconnect", () => {
			this.handleDisconnect();
		});
	}
}

export function createCoinbaseAdapter(): CoinbaseAdapter {
	return new CoinbaseAdapter();
}
