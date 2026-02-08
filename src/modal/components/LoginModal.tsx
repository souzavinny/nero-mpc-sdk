import type React from "react";
import { useState } from "react";
import type { OAuthProvider } from "../../nero-sdk";
import { useTheme } from "../../react/theme";
import { LoginButton } from "./LoginButton";
import { Modal } from "./Modal";

export interface LoginModalProps {
	isOpen: boolean;
	onClose: () => void;
	onLogin: (provider: OAuthProvider) => Promise<void>;
	providers?: OAuthProvider[];
	title?: string;
	subtitle?: string;
	logo?: string;
}

export function LoginModal({
	isOpen,
	onClose,
	onLogin,
	providers = ["google", "github", "apple"],
	title = "Sign In",
	subtitle = "Choose a provider to continue",
	logo,
}: LoginModalProps): React.ReactElement {
	const { theme, uiConfig } = useTheme();
	const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(
		null,
	);

	const handleLogin = async (provider: OAuthProvider) => {
		setLoadingProvider(provider);
		try {
			await onLogin(provider);
		} finally {
			setLoadingProvider(null);
		}
	};

	const logoUrl = logo ?? uiConfig.logoLight;

	const headerStyle: React.CSSProperties = {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		marginBottom: theme.spacing.lg,
	};

	const logoStyle: React.CSSProperties = {
		width: "64px",
		height: "64px",
		marginBottom: theme.spacing.md,
		borderRadius: theme.borderRadius.lg,
	};

	const titleStyle: React.CSSProperties = {
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeXl,
		fontWeight: theme.typography.fontWeightBold,
		color: theme.colors.text,
		margin: 0,
		marginBottom: theme.spacing.xs,
	};

	const subtitleStyle: React.CSSProperties = {
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeSm,
		color: theme.colors.textMuted,
		margin: 0,
	};

	const providersContainerStyle: React.CSSProperties = {
		display: "flex",
		flexDirection: "column",
		gap: theme.spacing.sm,
	};

	const footerStyle: React.CSSProperties = {
		marginTop: theme.spacing.lg,
		paddingTop: theme.spacing.md,
		borderTop: `1px solid ${theme.colors.border}`,
		textAlign: "center",
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeXs,
		color: theme.colors.textMuted,
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose}>
			<div style={headerStyle}>
				{logoUrl && <img src={logoUrl} alt="Logo" style={logoStyle} />}
				<h1 style={titleStyle}>{title}</h1>
				<p style={subtitleStyle}>{subtitle}</p>
			</div>

			<div style={providersContainerStyle}>
				{providers.map((provider) => (
					<LoginButton
						key={provider}
						provider={provider}
						onClick={() => handleLogin(provider)}
						isLoading={loadingProvider === provider}
						disabled={loadingProvider !== null && loadingProvider !== provider}
					/>
				))}
			</div>

			<div style={footerStyle}>
				By continuing, you agree to our Terms of Service and Privacy Policy
			</div>
		</Modal>
	);
}
