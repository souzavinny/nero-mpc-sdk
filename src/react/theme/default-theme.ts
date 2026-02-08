import type {
	Theme,
	ThemeBorderRadius,
	ThemeColors,
	ThemeShadows,
	ThemeSpacing,
	ThemeTypography,
} from "./types";

const lightColors: ThemeColors = {
	primary: "#6366f1",
	primaryHover: "#4f46e5",
	secondary: "#8b5cf6",
	secondaryHover: "#7c3aed",
	background: "#ffffff",
	backgroundSecondary: "#f9fafb",
	surface: "#ffffff",
	surfaceHover: "#f3f4f6",
	text: "#111827",
	textSecondary: "#374151",
	textMuted: "#6b7280",
	border: "#e5e7eb",
	borderFocus: "#6366f1",
	error: "#ef4444",
	errorBackground: "#fef2f2",
	success: "#22c55e",
	successBackground: "#f0fdf4",
	warning: "#f59e0b",
	warningBackground: "#fffbeb",
	overlay: "rgba(0, 0, 0, 0.5)",
};

const darkColors: ThemeColors = {
	primary: "#818cf8",
	primaryHover: "#6366f1",
	secondary: "#a78bfa",
	secondaryHover: "#8b5cf6",
	background: "#0f172a",
	backgroundSecondary: "#1e293b",
	surface: "#1e293b",
	surfaceHover: "#334155",
	text: "#f8fafc",
	textSecondary: "#e2e8f0",
	textMuted: "#94a3b8",
	border: "#334155",
	borderFocus: "#818cf8",
	error: "#f87171",
	errorBackground: "#450a0a",
	success: "#4ade80",
	successBackground: "#052e16",
	warning: "#fbbf24",
	warningBackground: "#451a03",
	overlay: "rgba(0, 0, 0, 0.7)",
};

const typography: ThemeTypography = {
	fontFamily:
		'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
	fontFamilyMono:
		'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
	fontSizeXs: "0.75rem",
	fontSizeSm: "0.875rem",
	fontSizeMd: "1rem",
	fontSizeLg: "1.125rem",
	fontSizeXl: "1.25rem",
	fontWeightNormal: 400,
	fontWeightMedium: 500,
	fontWeightSemibold: 600,
	fontWeightBold: 700,
	lineHeightTight: 1.25,
	lineHeightNormal: 1.5,
	lineHeightRelaxed: 1.75,
};

const spacing: ThemeSpacing = {
	xs: "0.25rem",
	sm: "0.5rem",
	md: "1rem",
	lg: "1.5rem",
	xl: "2rem",
	xxl: "3rem",
};

const borderRadius: ThemeBorderRadius = {
	none: "0",
	sm: "0.25rem",
	md: "0.375rem",
	lg: "0.5rem",
	xl: "0.75rem",
	full: "9999px",
};

const shadows: ThemeShadows = {
	sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
	md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
	lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
	xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
};

export const lightTheme: Theme = {
	mode: "light",
	colors: lightColors,
	typography,
	spacing,
	borderRadius,
	shadows,
};

export const darkTheme: Theme = {
	mode: "dark",
	colors: darkColors,
	typography,
	spacing,
	borderRadius,
	shadows,
};

export function getDefaultTheme(mode: "light" | "dark"): Theme {
	return mode === "dark" ? darkTheme : lightTheme;
}

export function createTheme(
	mode: "light" | "dark",
	overrides?: {
		primary?: string;
		secondary?: string;
		background?: string;
		text?: string;
		border?: string;
		fontFamily?: string;
	},
): Theme {
	const base = getDefaultTheme(mode);

	if (!overrides) {
		return base;
	}

	return {
		...base,
		colors: {
			...base.colors,
			...(overrides.primary && { primary: overrides.primary }),
			...(overrides.secondary && { secondary: overrides.secondary }),
			...(overrides.background && { background: overrides.background }),
			...(overrides.text && { text: overrides.text }),
			...(overrides.border && { border: overrides.border }),
		},
		typography: {
			...base.typography,
			...(overrides.fontFamily && { fontFamily: overrides.fontFamily }),
		},
	};
}
