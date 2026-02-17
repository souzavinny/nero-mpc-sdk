import type React from "react";
import { useState } from "react";
import { useTheme } from "../../react/theme";
import type { KnownWallet } from "../utils/known-wallets";

export interface WalletDetailViewProps {
	wallet: KnownWallet;
}

export function WalletDetailView({
	wallet,
}: WalletDetailViewProps): React.ReactElement {
	const { theme } = useTheme();
	const [btnHovered, setBtnHovered] = useState(false);

	const containerStyle: React.CSSProperties = {
		display: "flex",
		flexDirection: "column",
		gap: theme.spacing.lg,
		width: "100%",
	};

	const iconBoxStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		padding: theme.spacing.xl,
		backgroundColor: theme.colors.surfaceHover,
		border: `1px solid ${theme.colors.border}`,
		borderRadius: theme.borderRadius.lg,
	};

	const iconStyle: React.CSSProperties = {
		width: "64px",
		height: "64px",
		borderRadius: theme.borderRadius.lg,
		objectFit: "contain",
	};

	const promptBoxStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: theme.spacing.md,
		backgroundColor: theme.colors.surfaceHover,
		border: `1px solid ${theme.colors.border}`,
		borderRadius: theme.borderRadius.lg,
		fontFamily: theme.typography.fontFamily,
	};

	const promptTextStyle: React.CSSProperties = {
		fontSize: theme.typography.fontSizeSm,
		color: theme.colors.text,
	};

	const buttonStyle: React.CSSProperties = {
		padding: `${theme.spacing.xs} ${theme.spacing.md}`,
		backgroundColor: btnHovered ? theme.colors.primaryHover : theme.colors.primary,
		color: "#fff",
		border: "none",
		borderRadius: theme.borderRadius.md,
		cursor: "pointer",
		fontSize: theme.typography.fontSizeSm,
		fontWeight: theme.typography.fontWeightMedium,
		fontFamily: theme.typography.fontFamily,
		transition: "background-color 0.2s",
		flexShrink: 0,
	};

	return (
		<div style={containerStyle}>
			<div style={iconBoxStyle}>
				<img src={wallet.icon} alt={wallet.name} style={iconStyle} />
			</div>
			<div style={promptBoxStyle}>
				<span style={promptTextStyle}>
					Don&apos;t have {wallet.name}?
				</span>
				<a
					href={wallet.downloadUrl}
					target="_blank"
					rel="noopener noreferrer"
					style={{ textDecoration: "none" }}
				>
					<button
						type="button"
						style={buttonStyle}
						onMouseEnter={() => setBtnHovered(true)}
						onMouseLeave={() => setBtnHovered(false)}
					>
						Get Wallet
					</button>
				</a>
			</div>
		</div>
	);
}
