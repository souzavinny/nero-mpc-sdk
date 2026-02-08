export type {
	Theme,
	ThemeColors,
	ThemeTypography,
	ThemeSpacing,
	ThemeBorderRadius,
	ThemeShadows,
	UIConfig,
	ThemeOverrides,
	ThemeMode,
} from "./types";

export {
	lightTheme,
	darkTheme,
	getDefaultTheme,
	createTheme,
} from "./default-theme";

export {
	ThemeProvider,
	useTheme,
	useThemeColors,
	useResolvedMode,
	type ThemeContextValue,
	type ThemeProviderProps,
} from "./theme-context";
