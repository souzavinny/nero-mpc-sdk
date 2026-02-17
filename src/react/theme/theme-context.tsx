import type React from "react";
import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { createTheme, getDefaultTheme } from "./default-theme";
import type { Theme, ThemeMode, UIConfig } from "./types";

export interface ThemeContextValue {
	theme: Theme;
	mode: ThemeMode;
	resolvedMode: "light" | "dark";
	setMode: (mode: ThemeMode) => void;
	uiConfig: UIConfig;
	logo: string | undefined;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
	children: ReactNode;
	uiConfig?: UIConfig;
	defaultMode?: ThemeMode;
}

function getSystemTheme(): "light" | "dark" {
	if (typeof window === "undefined" || !window.matchMedia) {
		return "light";
	}
	try {
		return window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light";
	} catch {
		return "light";
	}
}

export function ThemeProvider({
	children,
	uiConfig,
	defaultMode = "auto",
}: ThemeProviderProps): React.ReactElement {
	const [mode, setMode] = useState<ThemeMode>(defaultMode);
	const [systemTheme, setSystemTheme] = useState<"light" | "dark">(
		getSystemTheme,
	);

	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return undefined;

		try {
			const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

			const handleChange = (e: MediaQueryListEvent) => {
				setSystemTheme(e.matches ? "dark" : "light");
			};

			mediaQuery.addEventListener("change", handleChange);
			return () => mediaQuery.removeEventListener("change", handleChange);
		} catch {
			return undefined;
		}
	}, []);

	const resolvedMode = useMemo(() => {
		if (mode === "auto") {
			return systemTheme;
		}
		return mode;
	}, [mode, systemTheme]);

	const theme = useMemo(() => {
		const overrides = uiConfig?.theme;
		if (overrides) {
			return createTheme(resolvedMode, overrides);
		}
		return getDefaultTheme(resolvedMode);
	}, [resolvedMode, uiConfig?.theme]);

	const logo = useMemo(() => {
		if (!uiConfig) return undefined;
		return resolvedMode === "dark" ? uiConfig.logoDark : uiConfig.logoLight;
	}, [uiConfig, resolvedMode]);

	const config: UIConfig = useMemo(() => {
		return {
			appName: uiConfig?.appName ?? "NERO MPC Wallet",
			logoLight: uiConfig?.logoLight,
			logoDark: uiConfig?.logoDark,
			mode: uiConfig?.mode ?? defaultMode,
			theme: uiConfig?.theme,
			defaultLanguage: uiConfig?.defaultLanguage ?? "en",
		};
	}, [uiConfig, defaultMode]);

	const handleSetMode = useCallback((newMode: ThemeMode) => {
		setMode(newMode);
		if (typeof localStorage !== "undefined") {
			localStorage.setItem("nero-theme-mode", newMode);
		}
	}, []);

	useEffect(() => {
		if (typeof localStorage === "undefined") return;
		const stored = localStorage.getItem("nero-theme-mode") as ThemeMode | null;
		if (stored && ["light", "dark", "auto"].includes(stored)) {
			setMode(stored);
		}
	}, []);

	const value = useMemo<ThemeContextValue>(
		() => ({
			theme,
			mode,
			resolvedMode,
			setMode: handleSetMode,
			uiConfig: config,
			logo,
		}),
		[theme, mode, resolvedMode, handleSetMode, config, logo],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}

const fallbackThemeValue: ThemeContextValue = {
	theme: getDefaultTheme("dark"),
	mode: "dark",
	resolvedMode: "dark",
	setMode: () => {},
	uiConfig: {
		appName: "NERO MPC Wallet",
		mode: "dark",
		defaultLanguage: "en",
	},
	logo: undefined,
};

export function useTheme(): ThemeContextValue {
	const context = useContext(ThemeContext);
	if (!context) {
		return fallbackThemeValue;
	}
	return context;
}

export function useThemeColors() {
	const { theme } = useTheme();
	return theme.colors;
}

export function useResolvedMode(): "light" | "dark" {
	const { resolvedMode } = useTheme();
	return resolvedMode;
}
