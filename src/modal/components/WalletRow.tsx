import type React from "react";
import { useState } from "react";
import { useTheme } from "../../react/theme";

export interface WalletRowProps {
	name: string;
	icon: string;
	badge?: string;
	onClick: () => void;
	disabled?: boolean;
}

export function WalletRow({
	name,
	icon,
	badge,
	onClick,
	disabled = false,
}: WalletRowProps): React.ReactElement {
	const { theme } = useTheme();
	const [hovered, setHovered] = useState(false);

	const rowStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing.sm,
		width: "100%",
		padding: `${theme.spacing.sm} ${theme.spacing.md}`,
		backgroundColor: hovered
			? theme.colors.surfaceHover
			: "transparent",
		border: `1px solid ${theme.colors.border}`,
		borderRadius: theme.borderRadius.lg,
		cursor: disabled ? "not-allowed" : "pointer",
		opacity: disabled ? 0.6 : 1,
		transition: "background-color 0.2s",
		fontFamily: theme.typography.fontFamily,
	};

	const iconStyle: React.CSSProperties = {
		width: "28px",
		height: "28px",
		borderRadius: theme.borderRadius.md,
		objectFit: "contain",
		flexShrink: 0,
	};

	const nameStyle: React.CSSProperties = {
		flex: 1,
		fontSize: theme.typography.fontSizeSm,
		fontWeight: theme.typography.fontWeightMedium,
		color: theme.colors.text,
		textAlign: "left",
	};

	const badgeStyle: React.CSSProperties = {
		fontSize: theme.typography.fontSizeXs,
		fontWeight: theme.typography.fontWeightMedium,
		color: theme.colors.primary,
		backgroundColor: theme.mode === "dark"
			? "rgba(129, 140, 248, 0.15)"
			: "rgba(99, 102, 241, 0.1)",
		padding: "2px 8px",
		borderRadius: theme.borderRadius.full,
		flexShrink: 0,
	};

	return (
		<button
			onClick={onClick}
			disabled={disabled}
			style={rowStyle}
			onMouseEnter={() => {
				if (!disabled) setHovered(true);
			}}
			onMouseLeave={() => setHovered(false)}
		>
			<img src={icon} alt={name} style={iconStyle} />
			<span style={nameStyle}>{name}</span>
			{badge && <span style={badgeStyle}>{badge}</span>}
		</button>
	);
}
