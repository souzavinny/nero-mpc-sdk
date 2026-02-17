import type React from "react";
import { useMemo } from "react";
import { useTheme } from "../../react/theme";
import type { DetectedWallet } from "../utils/wallet-discovery";
import { type KnownWallet, KNOWN_WALLETS } from "../utils/known-wallets";
import { WalletRow } from "./WalletRow";

export interface AllWalletsViewProps {
	detectedWallets: DetectedWallet[];
	onWalletConnect?: (wallet: DetectedWallet) => void;
	onWalletDetail: (wallet: KnownWallet) => void;
}

export function AllWalletsView({
	detectedWallets,
	onWalletConnect,
	onWalletDetail,
}: AllWalletsViewProps): React.ReactElement {
	const { theme } = useTheme();

	const notInstalledWallets = useMemo(() => {
		const detectedRdns = new Set(
			detectedWallets.map((w) => w.info.rdns.toLowerCase()),
		);
		const detectedNames = new Set(
			detectedWallets.map((w) => w.info.name.toLowerCase()),
		);
		return KNOWN_WALLETS.filter(
			(kw) =>
				!detectedRdns.has(kw.rdns.toLowerCase()) &&
				!detectedNames.has(kw.name.toLowerCase()),
		);
	}, [detectedWallets]);

	const containerStyle: React.CSSProperties = {
		display: "flex",
		flexDirection: "column",
		gap: theme.spacing.sm,
		width: "100%",
	};

	return (
		<div style={containerStyle}>
			{detectedWallets.map((wallet) => (
				<WalletRow
					key={wallet.info.uuid}
					name={wallet.info.name}
					icon={wallet.info.icon}
					badge="Installed"
					onClick={() => onWalletConnect?.(wallet)}
				/>
			))}
			{notInstalledWallets.map((wallet) => (
				<WalletRow
					key={wallet.rdns}
					name={wallet.name}
					icon={wallet.icon}
					onClick={() => onWalletDetail(wallet)}
				/>
			))}
		</div>
	);
}
