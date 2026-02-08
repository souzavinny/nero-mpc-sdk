export interface ThemeColors {
	primary: string;
	primaryHover: string;
	secondary: string;
	secondaryHover: string;
	background: string;
	backgroundSecondary: string;
	surface: string;
	surfaceHover: string;
	text: string;
	textSecondary: string;
	textMuted: string;
	border: string;
	borderFocus: string;
	error: string;
	errorBackground: string;
	success: string;
	successBackground: string;
	warning: string;
	warningBackground: string;
	overlay: string;
}

export interface ThemeTypography {
	fontFamily: string;
	fontFamilyMono: string;
	fontSizeXs: string;
	fontSizeSm: string;
	fontSizeMd: string;
	fontSizeLg: string;
	fontSizeXl: string;
	fontWeightNormal: number;
	fontWeightMedium: number;
	fontWeightSemibold: number;
	fontWeightBold: number;
	lineHeightTight: number;
	lineHeightNormal: number;
	lineHeightRelaxed: number;
}

export interface ThemeSpacing {
	xs: string;
	sm: string;
	md: string;
	lg: string;
	xl: string;
	xxl: string;
}

export interface ThemeBorderRadius {
	none: string;
	sm: string;
	md: string;
	lg: string;
	xl: string;
	full: string;
}

export interface ThemeShadows {
	sm: string;
	md: string;
	lg: string;
	xl: string;
}

export interface Theme {
	mode: "light" | "dark";
	colors: ThemeColors;
	typography: ThemeTypography;
	spacing: ThemeSpacing;
	borderRadius: ThemeBorderRadius;
	shadows: ThemeShadows;
}

export interface UIConfig {
	appName: string;
	logoLight?: string;
	logoDark?: string;
	mode?: "light" | "dark" | "auto";
	theme?: Partial<ThemeOverrides>;
	defaultLanguage?: string;
}

export interface ThemeOverrides {
	primary?: string;
	secondary?: string;
	background?: string;
	text?: string;
	border?: string;
	fontFamily?: string;
	borderRadius?: string;
}

export type ThemeMode = "light" | "dark" | "auto";
