import type React from "react";
import { useEffect, useState } from "react";
import type { OAuthProvider } from "../../nero-sdk";
import { useTheme } from "../../react/theme";
import type { KnownWallet } from "../utils/known-wallets";
import {
	type DetectedWallet,
	useDetectedWallets,
} from "../utils/wallet-discovery";
import { AllWalletsView } from "./AllWalletsView";
import { Divider } from "./Divider";
import { LoginButton } from "./LoginButton";
import { Modal } from "./Modal";
import { NeroLogo } from "./NeroLogo";
import { WalletDetailView } from "./WalletDetailView";
import { WalletRow } from "./WalletRow";

const N27_FONT_FAMILY = "'N27', sans-serif";
const N27_FONT_CSS_ID = "nero-n27-font";
const MAX_VISIBLE_WALLETS = 2;

function injectN27Font() {
	if (typeof document === "undefined") return;
	if (document.getElementById(N27_FONT_CSS_ID)) return;

	const link = document.createElement("link");
	link.id = N27_FONT_CSS_ID;
	link.rel = "stylesheet";
	link.href = "https://fonts.cdnfonts.com/css/n27";
	document.head.appendChild(link);
}

type ModalView =
	| { type: "main" }
	| { type: "allWallets" }
	| { type: "walletDetail"; wallet: KnownWallet };

export interface LoginModalProps {
	isOpen: boolean;
	onClose: () => void;
	onLogin: (provider: OAuthProvider) => Promise<void>;
	providers?: OAuthProvider[];
	title?: string;
	logo?: string;
	showWallets?: boolean;
	onWalletConnect?: (wallet: DetectedWallet) => void;
}

const ALL_WALLETS_ICON =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236366f1'%3E%3Cpath d='M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z'/%3E%3C/svg%3E";

export function LoginModal({
	isOpen,
	onClose,
	onLogin,
	providers = ["google", "github", "apple"],
	title = "Sign in",
	logo,
	showWallets = true,
	onWalletConnect,
}: LoginModalProps): React.ReactElement {
	const { theme } = useTheme();
	const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(
		null,
	);
	const [view, setView] = useState<ModalView>({ type: "main" });
	const detectedWallets = useDetectedWallets();
	const hasWallets = showWallets && detectedWallets.length > 0;

	useEffect(() => {
		injectN27Font();
	}, []);

	useEffect(() => {
		if (!isOpen) {
			setView({ type: "main" });
		}
	}, [isOpen]);

	const handleLogin = async (provider: OAuthProvider) => {
		setLoadingProvider(provider);
		try {
			await onLogin(provider);
		} finally {
			setLoadingProvider(null);
		}
	};

	const goMain = () => setView({ type: "main" });
	const goAllWallets = () => setView({ type: "allWallets" });

	if (view.type === "walletDetail") {
		return (
			<Modal
				isOpen={isOpen}
				onClose={onClose}
				title={view.wallet.name}
				onBack={goAllWallets}
			>
				<WalletDetailView wallet={view.wallet} />
				<Footer theme={theme} />
			</Modal>
		);
	}

	if (view.type === "allWallets") {
		return (
			<Modal
				isOpen={isOpen}
				onClose={onClose}
				title="All Wallets"
				onBack={goMain}
			>
				<AllWalletsView
					detectedWallets={detectedWallets}
					onWalletConnect={onWalletConnect}
					onWalletDetail={(wallet) =>
						setView({ type: "walletDetail", wallet })
					}
				/>
				<Footer theme={theme} />
			</Modal>
		);
	}

	const visibleWallets = detectedWallets.slice(0, MAX_VISIBLE_WALLETS);
	const showAllWalletsRow = detectedWallets.length >= 3;

	const containerStyle: React.CSSProperties = {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		position: "relative",
	};

	const logoContainerStyle: React.CSSProperties = {
		marginBottom: theme.spacing.md,
	};

	const titleStyle: React.CSSProperties = {
		fontFamily: N27_FONT_FAMILY,
		fontSize: theme.typography.fontSizeXl,
		fontWeight: theme.typography.fontWeightBold,
		color: theme.colors.text,
		margin: 0,
		marginBottom: theme.spacing.lg,
		textAlign: "center",
	};

	const socialRowStyle: React.CSSProperties = {
		display: "flex",
		justifyContent: "center",
		gap: theme.spacing.sm,
		flexWrap: "wrap",
	};

	const walletsContainerStyle: React.CSSProperties = {
		display: "flex",
		flexDirection: "column",
		gap: theme.spacing.sm,
		width: "100%",
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose}>
			<div style={containerStyle}>
				{logo ? (
					<div style={logoContainerStyle}>
						<img
							src={logo}
							alt="Logo"
							style={{
								width: "140px",
								height: "32px",
								objectFit: "contain",
							}}
						/>
					</div>
				) : (
					<div style={logoContainerStyle}>
						<NeroLogo />
					</div>
				)}

				<h1 style={titleStyle}>{title}</h1>

				<div style={socialRowStyle}>
					{providers.map((provider) => (
						<LoginButton
							key={provider}
							provider={provider}
							onClick={() => handleLogin(provider)}
							isLoading={loadingProvider === provider}
							disabled={
								loadingProvider !== null &&
								loadingProvider !== provider
							}
							compact
						/>
					))}
				</div>

				{hasWallets && (
					<>
						<Divider />
						<div style={walletsContainerStyle}>
							{visibleWallets.map((wallet) => (
								<WalletRow
									key={wallet.info.uuid}
									name={wallet.info.name}
									icon={wallet.info.icon}
									badge="Installed"
									onClick={() =>
										onWalletConnect?.(wallet)
									}
								/>
							))}
							{showAllWalletsRow && (
								<WalletRow
									name="All Wallets"
									icon={ALL_WALLETS_ICON}
									onClick={goAllWallets}
								/>
							)}
						</div>
					</>
				)}

				<Footer theme={theme} />
			</div>
		</Modal>
	);
}

function Footer({
	theme,
}: { theme: ReturnType<typeof useTheme>["theme"] }): React.ReactElement {
	const footerStyle: React.CSSProperties = {
		marginTop: theme.spacing.lg,
		textAlign: "center",
		fontFamily: N27_FONT_FAMILY,
		fontSize: theme.typography.fontSizeXs,
		color: theme.colors.textMuted,
	};

	return <div style={footerStyle}>Powered by NERO Chain</div>;
}
