import { useEffect, useState } from "react";

export interface EIP6963ProviderInfo {
	uuid: string;
	name: string;
	icon: string;
	rdns: string;
}

export interface DetectedWallet {
	info: EIP6963ProviderInfo;
	provider: unknown;
}

interface EIP6963AnnounceProviderEvent extends Event {
	detail: {
		info: EIP6963ProviderInfo;
		provider: unknown;
	};
}

export function discoverWallets(): Promise<DetectedWallet[]> {
	if (typeof window === "undefined") {
		return Promise.resolve([]);
	}

	const wallets: DetectedWallet[] = [];
	const seen = new Set<string>();

	return new Promise((resolve) => {
		const handler = (event: Event) => {
			const e = event as EIP6963AnnounceProviderEvent;
			if (e.detail?.info?.uuid && !seen.has(e.detail.info.uuid)) {
				seen.add(e.detail.info.uuid);
				wallets.push({
					info: e.detail.info,
					provider: e.detail.provider,
				});
			}
		};

		window.addEventListener("eip6963:announceProvider", handler);
		window.dispatchEvent(new Event("eip6963:requestProvider"));

		setTimeout(() => {
			window.removeEventListener("eip6963:announceProvider", handler);
			resolve(wallets);
		}, 200);
	});
}

export function useDetectedWallets(): DetectedWallet[] {
	const [wallets, setWallets] = useState<DetectedWallet[]>([]);

	useEffect(() => {
		discoverWallets().then(setWallets);
	}, []);

	return wallets;
}
