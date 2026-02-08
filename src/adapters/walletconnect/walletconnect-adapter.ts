import type { EIP1193Provider } from "../../core/provider-types";
import { type AdapterConfig, BaseWalletAdapter } from "../base-adapter";

export interface WalletConnectConfig extends AdapterConfig {
	projectId: string;
	chains?: number[];
	showQrModal?: boolean;
	qrModalOptions?: {
		themeMode?: "light" | "dark";
		themeVariables?: Record<string, string>;
	};
}

export class WalletConnectAdapter extends BaseWalletAdapter {
	readonly name = "WalletConnect";
	readonly icon = "https://walletconnect.com/walletconnect-logo.png";
	readonly url = "https://walletconnect.com";

	private ethereumProvider: any = null;

	async connect(config?: WalletConnectConfig): Promise<string[]> {
		if (!config?.projectId) {
			throw new Error("WalletConnect projectId is required");
		}

		this.setStatus("connecting");

		try {
			const EthereumProvider = await this.loadEthereumProvider();

			this.ethereumProvider = await EthereumProvider.init({
				projectId: config.projectId,
				chains: config.chains ?? [1],
				showQrModal: config.showQrModal ?? true,
				qrModalOptions: config.qrModalOptions,
			});

			await this.ethereumProvider.enable();

			const accounts = this.ethereumProvider.accounts as string[];
			const chainId = this.ethereumProvider.chainId as number;

			this._provider = this.ethereumProvider as EIP1193Provider;

			this.setupEventListeners();
			this.handleConnect(chainId, accounts);

			return accounts;
		} catch (error) {
			this.handleError(error as Error);
			throw error;
		}
	}

	async disconnect(): Promise<void> {
		if (this.ethereumProvider) {
			try {
				await this.ethereumProvider.disconnect();
			} catch {
				// Ignore disconnect errors
			}
			this.ethereumProvider = null;
		}
		this.handleDisconnect();
	}

	async switchChain(chainId: number): Promise<void> {
		if (!this.ethereumProvider) {
			throw new Error("Not connected");
		}

		try {
			await this.ethereumProvider.request({
				method: "wallet_switchEthereumChain",
				params: [{ chainId: `0x${chainId.toString(16)}` }],
			});
		} catch (error: any) {
			if (error.code === 4902) {
				throw new Error(`Chain ${chainId} not supported by WalletConnect`);
			}
			throw error;
		}
	}

	private async loadEthereumProvider(): Promise<any> {
		try {
			// @ts-expect-error - Optional peer dependency
			const module = await import("@walletconnect/ethereum-provider");
			return module.default || module.EthereumProvider;
		} catch {
			throw new Error(
				"WalletConnect provider not installed. " +
					"Please install @walletconnect/ethereum-provider",
			);
		}
	}

	private setupEventListeners(): void {
		if (!this.ethereumProvider) return;

		this.ethereumProvider.on("accountsChanged", (accounts: string[]) => {
			this.setAccounts(accounts);
			if (accounts.length === 0) {
				this.handleDisconnect();
			}
		});

		this.ethereumProvider.on("chainChanged", (chainId: number | string) => {
			const numericChainId =
				typeof chainId === "string" ? Number.parseInt(chainId, 16) : chainId;
			this.setChainId(numericChainId);
		});

		this.ethereumProvider.on("disconnect", () => {
			this.handleDisconnect();
		});
	}
}

export function createWalletConnectAdapter(): WalletConnectAdapter {
	return new WalletConnectAdapter();
}
