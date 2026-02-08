import type { EIP1193Provider } from "../../core/provider-types";
import { type AdapterConfig, BaseWalletAdapter } from "../base-adapter";

export interface MetaMaskConfig extends AdapterConfig {
	infuraApiKey?: string;
	dappMetadata?: {
		name: string;
		url?: string;
		iconUrl?: string;
	};
}

declare global {
	interface Window {
		ethereum?: EIP1193Provider & {
			isMetaMask?: boolean;
			providers?: Array<EIP1193Provider & { isMetaMask?: boolean }>;
		};
	}
}

export class MetaMaskAdapter extends BaseWalletAdapter {
	readonly name = "MetaMask";
	readonly icon = "https://metamask.io/images/metamask-fox.svg";
	readonly url = "https://metamask.io";

	private config: MetaMaskConfig | null = null;

	async connect(config?: MetaMaskConfig): Promise<string[]> {
		this.config = config ?? null;
		this.setStatus("connecting");

		try {
			const provider = this.getMetaMaskProvider();

			if (!provider) {
				const installed = await this.checkMetaMaskSDK();
				if (!installed) {
					window.open(
						"https://metamask.io/download/",
						"_blank",
						"noopener,noreferrer",
					);
					throw new Error("MetaMask not installed");
				}
			}

			const metamaskProvider = this.getMetaMaskProvider();
			if (!metamaskProvider) {
				throw new Error("MetaMask provider not available");
			}

			const accounts = (await metamaskProvider.request({
				method: "eth_requestAccounts",
			})) as string[];

			const chainIdHex = (await metamaskProvider.request({
				method: "eth_chainId",
			})) as string;
			const chainId = Number.parseInt(chainIdHex, 16);

			this._provider = metamaskProvider;

			this.setupEventListeners(metamaskProvider);
			this.handleConnect(chainId, accounts);

			return accounts;
		} catch (error) {
			this.handleError(error as Error);
			throw error;
		}
	}

	async disconnect(): Promise<void> {
		this.handleDisconnect();
	}

	async switchChain(chainId: number): Promise<void> {
		const provider = this.getMetaMaskProvider();
		if (!provider) {
			throw new Error("MetaMask not available");
		}

		try {
			await provider.request({
				method: "wallet_switchEthereumChain",
				params: [{ chainId: `0x${chainId.toString(16)}` }],
			});
		} catch (error: any) {
			if (error.code === 4902) {
				throw new Error(
					`Chain ${chainId} not added to MetaMask. Please add it first using wallet_addEthereumChain.`,
				);
			}
			throw error;
		}
	}

	isInstalled(): boolean {
		return this.getMetaMaskProvider() !== null;
	}

	private getMetaMaskProvider(): EIP1193Provider | null {
		if (typeof window === "undefined") return null;

		const ethereum = window.ethereum;
		if (!ethereum) return null;

		if (ethereum.providers?.length) {
			const metamask = ethereum.providers.find((p) => p.isMetaMask);
			if (metamask) return metamask;
		}

		if (ethereum.isMetaMask) {
			return ethereum;
		}

		return null;
	}

	private async checkMetaMaskSDK(): Promise<boolean> {
		if (this.getMetaMaskProvider()) {
			return true;
		}

		if (!this.config?.dappMetadata) {
			return false;
		}

		try {
			// @ts-expect-error - Optional peer dependency
			const MetaMaskSDK = await import("@metamask/sdk");
			const sdk = new MetaMaskSDK.default({
				dappMetadata: this.config.dappMetadata,
				infuraAPIKey: this.config.infuraApiKey,
			});

			await sdk.init();
			return true;
		} catch {
			return false;
		}
	}

	private setupEventListeners(provider: EIP1193Provider): void {
		provider.on("accountsChanged", ((accounts: string[]) => {
			this.setAccounts(accounts);
			if (accounts.length === 0) {
				this.handleDisconnect();
			}
		}) as any);

		provider.on("chainChanged", ((chainId: string) => {
			this.setChainId(Number.parseInt(chainId, 16));
		}) as any);

		provider.on("disconnect", (() => {
			this.handleDisconnect();
		}) as any);
	}
}

export function createMetaMaskAdapter(): MetaMaskAdapter {
	return new MetaMaskAdapter();
}
