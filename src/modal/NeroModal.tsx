import type React from "react";
import { useCallback, useState } from "react";
import type { OAuthProvider } from "../nero-sdk";
import { useNeroMpcAuthContext } from "../react/context";
import { useTheme } from "../react/theme";
import { LoginModal } from "./components/LoginModal";
import { WalletModal } from "./components/WalletModal";

export interface NeroModalProps {
	providers?: OAuthProvider[];
	onLoginSuccess?: () => void;
	onLoginError?: (error: Error) => void;
	onLogout?: () => void;
	loginTitle?: string;
	loginSubtitle?: string;
	logo?: string;
	explorerUrlPattern?: string;
}

export function NeroModal({
	providers = ["google", "github", "apple"],
	onLoginSuccess,
	onLoginError,
	onLogout,
	loginTitle,
	loginSubtitle,
	logo,
	explorerUrlPattern,
}: NeroModalProps): React.ReactElement {
	const { sdk, state } = useNeroMpcAuthContext();
	const { theme } = useTheme();
	const [isLoginOpen, setIsLoginOpen] = useState(false);
	const [isWalletOpen, setIsWalletOpen] = useState(false);

	const handleLogin = useCallback(
		async (provider: OAuthProvider) => {
			if (!sdk) return;

			try {
				switch (provider) {
					case "google":
						await sdk.loginWithGoogle();
						break;
					case "github":
						await sdk.loginWithGithub();
						break;
					case "apple":
						await sdk.loginWithApple();
						break;
				}
				setIsLoginOpen(false);
				onLoginSuccess?.();
			} catch (error) {
				onLoginError?.(error as Error);
			}
		},
		[sdk, onLoginSuccess, onLoginError],
	);

	const handleDisconnect = useCallback(async () => {
		if (!sdk) return;
		await sdk.logout();
		setIsWalletOpen(false);
		onLogout?.();
	}, [sdk, onLogout]);

	const handleViewExplorer = useCallback(
		(address: string) => {
			let url: string | null = null;

			if (explorerUrlPattern) {
				url = explorerUrlPattern.replace("{address}", address);
			} else if (state.walletInfo) {
				const chainId = state.walletInfo.chainId;
				let baseUrl: string;
				switch (chainId) {
					case 689:
						baseUrl = "https://testnetscan.nerochain.io";
						break;
					case 1689:
						baseUrl = "https://scan.nerochain.io";
						break;
					case 1:
						baseUrl = "https://etherscan.io";
						break;
					case 137:
						baseUrl = "https://polygonscan.com";
						break;
					default:
						return;
				}
				url = `${baseUrl}/address/${address}`;
			}

			if (url && (url.startsWith("https://") || url.startsWith("http://"))) {
				window.open(url, "_blank", "noopener,noreferrer");
			}
		},
		[explorerUrlPattern, state.walletInfo],
	);

	const buttonStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing.sm,
		padding: `${theme.spacing.sm} ${theme.spacing.md}`,
		backgroundColor: theme.colors.primary,
		color: "#ffffff",
		border: "none",
		borderRadius: theme.borderRadius.lg,
		cursor: "pointer",
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeSm,
		fontWeight: theme.typography.fontWeightMedium,
		transition: "background-color 0.2s",
	};

	const truncateAddress = (address: string) => {
		return `${address.slice(0, 6)}...${address.slice(-4)}`;
	};

	return (
		<>
			{state.isAuthenticated && state.walletInfo ? (
				<button
					style={buttonStyle}
					onClick={() => setIsWalletOpen(true)}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = theme.colors.primary;
					}}
				>
					<WalletIcon />
					{truncateAddress(
						state.walletInfo.smartWalletAddress ?? state.walletInfo.eoaAddress,
					)}
				</button>
			) : (
				<button
					style={buttonStyle}
					onClick={() => setIsLoginOpen(true)}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = theme.colors.primary;
					}}
				>
					Connect Wallet
				</button>
			)}

			<LoginModal
				isOpen={isLoginOpen}
				onClose={() => setIsLoginOpen(false)}
				onLogin={handleLogin}
				providers={providers}
				title={loginTitle}
				subtitle={loginSubtitle}
				logo={logo}
			/>

			<WalletModal
				isOpen={isWalletOpen}
				onClose={() => setIsWalletOpen(false)}
				walletInfo={state.walletInfo}
				onDisconnect={handleDisconnect}
				onViewExplorer={handleViewExplorer}
			/>
		</>
	);
}

function WalletIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<path d="M21 12V7H5a2 2 0 010-4h14v4" />
			<path d="M3 5v14a2 2 0 002 2h16v-5" />
			<path d="M18 12a2 2 0 100 4 2 2 0 000-4z" />
		</svg>
	);
}
