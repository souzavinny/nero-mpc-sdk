import React, { type ButtonHTMLAttributes, type ReactNode } from "react";
import { useTheme } from "../../react/theme";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "secondary" | "outline" | "ghost";
	size?: "sm" | "md" | "lg";
	isLoading?: boolean;
	leftIcon?: ReactNode;
	rightIcon?: ReactNode;
	fullWidth?: boolean;
}

export function Button({
	children,
	variant = "primary",
	size = "md",
	isLoading = false,
	leftIcon,
	rightIcon,
	fullWidth = false,
	disabled,
	style,
	...props
}: ButtonProps): React.ReactElement {
	const { theme } = useTheme();

	const getBackgroundColor = () => {
		switch (variant) {
			case "primary":
				return theme.colors.primary;
			case "secondary":
				return theme.colors.secondary;
			case "outline":
			case "ghost":
				return "transparent";
		}
	};

	const getHoverBackgroundColor = () => {
		switch (variant) {
			case "primary":
				return theme.colors.primaryHover;
			case "secondary":
				return theme.colors.secondaryHover;
			case "outline":
				return theme.colors.surfaceHover;
			case "ghost":
				return theme.colors.surfaceHover;
		}
	};

	const getTextColor = () => {
		switch (variant) {
			case "primary":
			case "secondary":
				return "#ffffff";
			case "outline":
				return theme.colors.primary;
			case "ghost":
				return theme.colors.text;
		}
	};

	const getBorder = () => {
		switch (variant) {
			case "outline":
				return `1px solid ${theme.colors.primary}`;
			default:
				return "none";
		}
	};

	const getPadding = () => {
		switch (size) {
			case "sm":
				return `${theme.spacing.xs} ${theme.spacing.sm}`;
			case "md":
				return `${theme.spacing.sm} ${theme.spacing.md}`;
			case "lg":
				return `${theme.spacing.md} ${theme.spacing.lg}`;
		}
	};

	const getFontSize = () => {
		switch (size) {
			case "sm":
				return theme.typography.fontSizeSm;
			case "md":
				return theme.typography.fontSizeMd;
			case "lg":
				return theme.typography.fontSizeLg;
		}
	};

	const buttonStyle: React.CSSProperties = {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		gap: theme.spacing.sm,
		backgroundColor: getBackgroundColor(),
		color: getTextColor(),
		border: getBorder(),
		borderRadius: theme.borderRadius.lg,
		padding: getPadding(),
		fontSize: getFontSize(),
		fontWeight: theme.typography.fontWeightMedium,
		fontFamily: theme.typography.fontFamily,
		cursor: disabled || isLoading ? "not-allowed" : "pointer",
		opacity: disabled || isLoading ? 0.6 : 1,
		transition: "background-color 0.2s, opacity 0.2s",
		width: fullWidth ? "100%" : "auto",
		...style,
	};

	return (
		<button
			{...props}
			disabled={disabled || isLoading}
			style={buttonStyle}
			onMouseEnter={(e) => {
				if (!disabled && !isLoading) {
					e.currentTarget.style.backgroundColor = getHoverBackgroundColor();
				}
			}}
			onMouseLeave={(e) => {
				if (!disabled && !isLoading) {
					e.currentTarget.style.backgroundColor = getBackgroundColor();
				}
			}}
		>
			{isLoading ? (
				<LoadingSpinner size={size} />
			) : (
				<>
					{leftIcon}
					{children}
					{rightIcon}
				</>
			)}
		</button>
	);
}

function LoadingSpinner({ size }: { size: "sm" | "md" | "lg" }) {
	const dimensions = size === "sm" ? 14 : size === "md" ? 16 : 20;

	return (
		<svg
			width={dimensions}
			height={dimensions}
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
