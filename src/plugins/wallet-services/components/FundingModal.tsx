import type React from "react";
import { Modal } from "../../../modal/components/Modal";
import { useTheme } from "../../../react/theme";
import type { FundingProvider } from "../types";

export interface FundingModalProps {
	isOpen: boolean;
	onClose: () => void;
	address: string;
	chainId: number;
	providers?: FundingProvider[];
	onSelectProvider?: (provider: FundingProvider) => void;
}

const DEFAULT_PROVIDERS: FundingProvider[] = [
	{
		id: "moonpay",
		name: "MoonPay",
		url: "https://www.moonpay.com/buy",
		supportedChains: [1, 137, 42161, 8453],
	},
	{
		id: "transak",
		name: "Transak",
		url: "https://global.transak.com",
		supportedChains: [1, 137, 42161, 8453],
	},
	{
		id: "faucet",
		name: "NERO Testnet Faucet",
		url: "https://faucet.nerochain.io",
		supportedChains: [689],
	},
];

export function FundingModal({
	isOpen,
	onClose,
	address,
	chainId,
	providers = DEFAULT_PROVIDERS,
	onSelectProvider,
}: FundingModalProps): React.ReactElement {
	const { theme } = useTheme();

	const availableProviders = providers.filter((p) =>
		p.supportedChains.includes(chainId),
	);

	const handleProviderClick = (provider: FundingProvider) => {
		onSelectProvider?.(provider);

		let url = provider.url;
		if (provider.id === "moonpay") {
			url = `${provider.url}?walletAddress=${address}`;
		} else if (provider.id === "transak") {
			url = `${provider.url}?walletAddress=${address}`;
		} else if (provider.id === "faucet") {
			url = `${provider.url}?address=${address}`;
		}

		if (url.startsWith("https://") || url.startsWith("http://")) {
			window.open(url, "_blank", "noopener,noreferrer");
		}
	};

	const containerStyle: React.CSSProperties = {
		display: "flex",
		flexDirection: "column",
		gap: theme.spacing.md,
	};

	const headerTextStyle: React.CSSProperties = {
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeSm,
		color: theme.colors.textMuted,
		textAlign: "center",
		marginBottom: theme.spacing.sm,
	};

	const providerStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing.md,
		padding: theme.spacing.lg,
		backgroundColor: theme.colors.backgroundSecondary,
		border: `1px solid ${theme.colors.border}`,
		borderRadius: theme.borderRadius.lg,
		cursor: "pointer",
		width: "100%",
		transition: "border-color 0.2s, background-color 0.2s",
	};

	const providerIconStyle: React.CSSProperties = {
		width: "48px",
		height: "48px",
		borderRadius: theme.borderRadius.lg,
		backgroundColor: theme.colors.primary,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		color: "#ffffff",
		fontWeight: theme.typography.fontWeightBold,
		fontSize: theme.typography.fontSizeLg,
	};

	const providerInfoStyle: React.CSSProperties = {
		flex: 1,
		textAlign: "left",
	};

	const providerNameStyle: React.CSSProperties = {
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeMd,
		fontWeight: theme.typography.fontWeightMedium,
		color: theme.colors.text,
		marginBottom: theme.spacing.xs,
	};

	const providerDescStyle: React.CSSProperties = {
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeXs,
		color: theme.colors.textMuted,
	};

	const emptyStyle: React.CSSProperties = {
		textAlign: "center",
		padding: theme.spacing.xl,
		color: theme.colors.textMuted,
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeSm,
	};

	const getProviderDescription = (id: string): string => {
		switch (id) {
			case "moonpay":
				return "Buy crypto with card or bank transfer";
			case "transak":
				return "Buy crypto with 100+ payment methods";
			case "faucet":
				return "Get free testnet tokens";
			default:
				return "Buy crypto";
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Buy Crypto" width="400px">
			<div style={containerStyle}>
				<p style={headerTextStyle}>Choose a provider to fund your wallet</p>

				{availableProviders.length === 0 ? (
					<div style={emptyStyle}>
						No funding providers available for this chain
					</div>
				) : (
					availableProviders.map((provider) => (
						<button
							key={provider.id}
							style={providerStyle}
							onClick={() => handleProviderClick(provider)}
							onMouseEnter={(e) => {
								e.currentTarget.style.borderColor = theme.colors.borderFocus;
								e.currentTarget.style.backgroundColor =
									theme.colors.surfaceHover;
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.borderColor = theme.colors.border;
								e.currentTarget.style.backgroundColor =
									theme.colors.backgroundSecondary;
							}}
						>
							{provider.logoUrl ? (
								<img
									src={provider.logoUrl}
									alt={provider.name}
									style={{
										...providerIconStyle,
										backgroundColor: "transparent",
									}}
								/>
							) : (
								<div style={providerIconStyle}>{provider.name.charAt(0)}</div>
							)}
							<div style={providerInfoStyle}>
								<div style={providerNameStyle}>{provider.name}</div>
								<div style={providerDescStyle}>
									{getProviderDescription(provider.id)}
								</div>
							</div>
							<ArrowRightIcon />
						</button>
					))
				)}
			</div>
		</Modal>
	);
}

function ArrowRightIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			opacity={0.5}
		>
			<polyline points="9 18 15 12 9 6" />
		</svg>
	);
}
