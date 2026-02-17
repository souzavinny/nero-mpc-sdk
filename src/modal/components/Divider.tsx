import type React from "react";
import { useTheme } from "../../react/theme";

export function Divider(): React.ReactElement {
	const { theme } = useTheme();

	const wrapperStyle: React.CSSProperties = {
		display: "flex",
		flexDirection: "column",
		width: "100%",
		margin: `${theme.spacing.md} 0`,
		gap: theme.spacing.md,
	};

	const rowStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing.md,
	};

	const lineStyle: React.CSSProperties = {
		flex: 1,
		height: "1px",
		backgroundColor: theme.colors.border,
	};

	const textStyle: React.CSSProperties = {
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeXs,
		fontWeight: theme.typography.fontWeightMedium,
		color: theme.colors.textMuted,
		textTransform: "uppercase",
		letterSpacing: "0.05em",
	};

	return (
		<div style={wrapperStyle}>
			<div style={rowStyle}>
				<div style={lineStyle} />
				<span style={textStyle}>or</span>
				<div style={lineStyle} />
			</div>
			<div style={lineStyle} />
		</div>
	);
}
