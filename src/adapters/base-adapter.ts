import type { EIP1193Provider } from "../core/provider-types";

export type AdapterStatus =
	| "disconnected"
	| "connecting"
	| "connected"
	| "errored";

export interface AdapterConfig {
	chainId?: number;
	autoConnect?: boolean;
}

export interface WalletAdapterEvents {
	connect: (info: { chainId: number; accounts: string[] }) => void;
	disconnect: (error?: Error) => void;
	accountsChanged: (accounts: string[]) => void;
	chainChanged: (chainId: number) => void;
	error: (error: Error) => void;
}

export abstract class BaseWalletAdapter {
	abstract readonly name: string;
	abstract readonly icon: string;
	abstract readonly url: string;

	protected _status: AdapterStatus = "disconnected";
	protected _accounts: string[] = [];
	protected _chainId: number | null = null;
	protected _provider: EIP1193Provider | null = null;

	private listeners: Map<
		keyof WalletAdapterEvents,
		Set<(...args: any[]) => void>
	> = new Map();

	get status(): AdapterStatus {
		return this._status;
	}

	get connected(): boolean {
		return this._status === "connected";
	}

	get accounts(): string[] {
		return this._accounts;
	}

	get chainId(): number | null {
		return this._chainId;
	}

	get provider(): EIP1193Provider | null {
		return this._provider;
	}

	abstract connect(config?: AdapterConfig): Promise<string[]>;
	abstract disconnect(): Promise<void>;
	abstract switchChain(chainId: number): Promise<void>;

	on<K extends keyof WalletAdapterEvents>(
		event: K,
		listener: WalletAdapterEvents[K],
	): this {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)?.add(listener as (...args: any[]) => void);
		return this;
	}

	off<K extends keyof WalletAdapterEvents>(
		event: K,
		listener: WalletAdapterEvents[K],
	): this {
		this.listeners.get(event)?.delete(listener as (...args: any[]) => void);
		return this;
	}

	protected emit<K extends keyof WalletAdapterEvents>(
		event: K,
		...args: Parameters<WalletAdapterEvents[K]>
	): void {
		const listeners = this.listeners.get(event);
		if (listeners) {
			for (const listener of listeners) {
				try {
					listener(...args);
				} catch {
					// Ignore listener errors
				}
			}
		}
	}

	protected setStatus(status: AdapterStatus): void {
		this._status = status;
	}

	protected setAccounts(accounts: string[]): void {
		const previousAccounts = this._accounts;
		this._accounts = accounts;

		if (
			accounts.length !== previousAccounts.length ||
			accounts.some((a, i) => a !== previousAccounts[i])
		) {
			this.emit("accountsChanged", accounts);
		}
	}

	protected setChainId(chainId: number): void {
		const previousChainId = this._chainId;
		this._chainId = chainId;

		if (chainId !== previousChainId) {
			this.emit("chainChanged", chainId);
		}
	}

	protected handleConnect(chainId: number, accounts: string[]): void {
		this._chainId = chainId;
		this._accounts = accounts;
		this._status = "connected";
		this.emit("connect", { chainId, accounts });
	}

	protected handleDisconnect(error?: Error): void {
		this._accounts = [];
		this._chainId = null;
		this._status = "disconnected";
		this._provider = null;
		this.emit("disconnect", error);
	}

	protected handleError(error: Error): void {
		this._status = "errored";
		this.emit("error", error);
	}
}

export type WalletAdapterConstructor = new (
	config?: AdapterConfig,
) => BaseWalletAdapter;
