import type React from "react";
import { useState } from "react";
import type { OAuthProvider } from "../../nero-sdk";
import { useTheme } from "../../react/theme";

export interface LoginButtonProps {
	provider: OAuthProvider;
	onClick: () => void;
	isLoading?: boolean;
	disabled?: boolean;
	compact?: boolean;
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

function DiscordIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="#5865F2">
			<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
		</svg>
	);
}

function LineIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="#00B900">
			<path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596a.626.626 0 0 1-.22.04.635.635 0 0 1-.516-.27l-2.443-3.317v2.951c0 .349-.282.63-.631.63a.627.627 0 0 1-.627-.63V8.108c0-.27.173-.51.43-.595a.63.63 0 0 1 .738.225l2.44 3.317V8.108c0-.345.283-.63.63-.63.349 0 .631.285.631.63v4.771zm-5.741 0c0 .349-.282.63-.631.63a.627.627 0 0 1-.627-.63V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.63H4.917c-.345 0-.63-.285-.63-.63V8.108c0-.345.285-.63.63-.63.349 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.122.301.079.766.039 1.068l-.171 1.027c-.053.303-.242 1.186 1.039.647 1.281-.54 6.911-4.069 9.428-6.967C23.547 14.032 24 12.282 24 10.314" />
		</svg>
	);
}

function TwitterIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
			<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
		</svg>
	);
}

function FacebookIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
			<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
		</svg>
	);
}

function LinkedInIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="#0A66C2">
			<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
		</svg>
	);
}

function WeChatIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="#07C160">
			<path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.062-6.122zm-2.18 2.907c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982z" />
		</svg>
	);
}

function GenericIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="#666666">
			<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
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
		case "discord":
			return <DiscordIcon />;
		case "line":
			return <LineIcon />;
		case "twitter":
			return <TwitterIcon />;
		case "facebook":
			return <FacebookIcon />;
		case "linkedin":
			return <LinkedInIcon />;
		case "wechat":
			return <WeChatIcon />;
		default:
			return <GenericIcon />;
	}
}

export function LoginButton({
	provider,
	onClick,
	isLoading = false,
	disabled = false,
	compact = false,
}: LoginButtonProps): React.ReactElement {
	const { theme } = useTheme();
	const config = providerConfig[provider] ?? defaultProviderConfig;
	const [hovered, setHovered] = useState(false);

	if (compact) {
		const compactStyle: React.CSSProperties = {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: "48px",
			height: "48px",
			backgroundColor: hovered
				? theme.colors.surfaceHover
				: "transparent",
			border: `1px solid ${hovered ? theme.colors.borderFocus : theme.colors.border}`,
			borderRadius: theme.borderRadius.xl,
			cursor: disabled || isLoading ? "not-allowed" : "pointer",
			opacity: disabled || isLoading ? 0.6 : 1,
			filter: hovered || isLoading ? "none" : "grayscale(1)",
			transition:
				"background-color 0.2s, border-color 0.2s, filter 0.3s ease",
			padding: 0,
		};

		return (
			<button
				onClick={onClick}
				disabled={disabled || isLoading}
				style={compactStyle}
				title={config.name}
				onMouseEnter={() => {
					if (!disabled && !isLoading) setHovered(true);
				}}
				onMouseLeave={() => setHovered(false)}
			>
				{isLoading ? <LoadingSpinner /> : getProviderIcon(provider)}
			</button>
		);
	}

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
					e.currentTarget.style.borderColor =
						theme.colors.borderFocus;
					e.currentTarget.style.backgroundColor =
						theme.colors.surfaceHover;
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
