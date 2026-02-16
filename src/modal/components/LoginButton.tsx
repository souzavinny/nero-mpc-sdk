import type React from "react";
import type { OAuthProvider } from "../../nero-sdk";
import { useTheme } from "../../react/theme";

export interface LoginButtonProps {
	provider: OAuthProvider;
	onClick: () => void;
	isLoading?: boolean;
	disabled?: boolean;
}

const providerConfig: Partial<
	Record<OAuthProvider, { name: string; iconColor: string; bgColor: string }>
> = {
	google: { name: "Google", iconColor: "#4285F4", bgColor: "#ffffff" },
	github: { name: "GitHub", iconColor: "#24292e", bgColor: "#ffffff" },
	apple: { name: "Apple", iconColor: "#000000", bgColor: "#ffffff" },
	discord: { name: "Discord", iconColor: "#5865F2", bgColor: "#ffffff" },
	line: { name: "LINE", iconColor: "#00B900", bgColor: "#ffffff" },
	linkedin: { name: "LinkedIn", iconColor: "#0A66C2", bgColor: "#ffffff" },
	twitter: { name: "Twitter", iconColor: "#1DA1F2", bgColor: "#ffffff" },
	wechat: { name: "WeChat", iconColor: "#07C160", bgColor: "#ffffff" },
	facebook: { name: "Facebook", iconColor: "#1877F2", bgColor: "#ffffff" },
};

const defaultProviderConfig = {
	name: "Provider",
	iconColor: "#666666",
	bgColor: "#ffffff",
};

function GoogleIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24">
			<path
				fill="#4285F4"
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
			/>
			<path
				fill="#34A853"
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
			/>
			<path
				fill="#FBBC05"
				d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
			/>
			<path
				fill="#EA4335"
				d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
			/>
		</svg>
	);
}

function GitHubIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="#24292e">
			<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
		</svg>
	);
}

function AppleIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="#000000">
			<path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
		</svg>
	);
}

function getProviderIcon(provider: OAuthProvider): React.ReactElement {
	switch (provider) {
		case "google":
			return <GoogleIcon />;
		case "github":
			return <GitHubIcon />;
		case "apple":
			return <AppleIcon />;
		default:
			return <GenericIcon />;
	}
}

function GenericIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="#666666">
			<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
		</svg>
	);
}

export function LoginButton({
	provider,
	onClick,
	isLoading = false,
	disabled = false,
}: LoginButtonProps): React.ReactElement {
	const { theme } = useTheme();
	const config = providerConfig[provider] ?? defaultProviderConfig;

	const buttonStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		gap: theme.spacing.sm,
		width: "100%",
		padding: `${theme.spacing.md} ${theme.spacing.lg}`,
		backgroundColor: config.bgColor,
		border: `1px solid ${theme.colors.border}`,
		borderRadius: theme.borderRadius.lg,
		cursor: disabled || isLoading ? "not-allowed" : "pointer",
		opacity: disabled || isLoading ? 0.6 : 1,
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeMd,
		fontWeight: theme.typography.fontWeightMedium,
		color: theme.colors.text,
		transition: "background-color 0.2s, border-color 0.2s",
	};

	return (
		<button
			onClick={onClick}
			disabled={disabled || isLoading}
			style={buttonStyle}
			onMouseEnter={(e) => {
				if (!disabled && !isLoading) {
					e.currentTarget.style.borderColor = theme.colors.borderFocus;
					e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
				}
			}}
			onMouseLeave={(e) => {
				if (!disabled && !isLoading) {
					e.currentTarget.style.borderColor = theme.colors.border;
					e.currentTarget.style.backgroundColor = config.bgColor;
				}
			}}
		>
			{isLoading ? (
				<LoadingSpinner />
			) : (
				<>
					{getProviderIcon(provider)}
					<span>Continue with {config.name}</span>
				</>
			)}
		</button>
	);
}

function LoadingSpinner() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			style={{
				animation: "spin 1s linear infinite",
			}}
		>
			<style>
				{
					"@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"
				}
			</style>
			<circle
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				strokeWidth="3"
				fill="none"
				strokeDasharray="60"
				strokeLinecap="round"
			/>
		</svg>
	);
}
