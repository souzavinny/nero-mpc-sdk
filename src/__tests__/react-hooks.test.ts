import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NeroSDKState } from "../nero-sdk";
import type { SDKConfig } from "../types";

const mockConfig: SDKConfig = {
	backendUrl: "https://api.test.com",
	chainId: 689,
};

const DEFAULT_STATE: NeroSDKState = {
	isAuthenticated: false,
	isInitialized: false,
	hasWallet: false,
	user: null,
	walletInfo: null,
	chainId: 689,
	isConnected: false,
};

const createMockSDK = (overrides = {}) => ({
	initialize: vi.fn().mockResolvedValue(undefined),
	loginWithGoogle: vi.fn().mockResolvedValue(undefined),
	loginWithGithub: vi.fn().mockResolvedValue(undefined),
	loginWithApple: vi.fn().mockResolvedValue(undefined),
	handleOAuthCallback: vi.fn().mockResolvedValue({
		user: { id: "user-123", email: "test@example.com" },
		requiresDKG: false,
	}),
	logout: vi.fn().mockResolvedValue(undefined),
	generateWallet: vi.fn().mockResolvedValue({
		address: "0x1234567890abcdef1234567890abcdef12345678",
		publicKey: "0xpubkey",
	}),
	wallet: {
		signMessage: vi.fn().mockResolvedValue({
			r: "0xr",
			s: "0xs",
			v: 27,
			fullSignature: "0xfullsig",
		}),
		signTypedData: vi.fn().mockResolvedValue({
			r: "0xr",
			s: "0xs",
			v: 27,
			fullSignature: "0xfullsig",
		}),
	},
	state: { ...DEFAULT_STATE, isInitialized: true },
	isAuthenticated: false,
	hasWallet: false,
	user: null,
	...overrides,
});

vi.mock("../nero-sdk", () => {
	return {
		NeroMpcSDK: vi.fn().mockImplementation(() => createMockSDK()),
	};
});

describe("React Hooks", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("useNeroMpcAuth", () => {
		it("should throw error when used outside provider", async () => {
			const { useNeroMpcAuth } = await import("../react");

			expect(() => {
				renderHook(() => useNeroMpcAuth());
			}).toThrow(
				"useNeroMpcAuthContext must be used within a NeroMpcAuthProvider",
			);
		});

		it("should return context values when used within provider", async () => {
			const { NeroMpcAuthProvider, useNeroMpcAuth } = await import("../react");

			function Wrapper({ children }: { children: React.ReactNode }) {
				return React.createElement(NeroMpcAuthProvider, {
					config: mockConfig,
					children,
				});
			}

			const { result } = renderHook(() => useNeroMpcAuth(), {
				wrapper: Wrapper,
			});

			expect(result.current).toHaveProperty("sdk");
			expect(result.current).toHaveProperty("isLoading");
			expect(result.current).toHaveProperty("error");
			expect(result.current).toHaveProperty("isAuthenticated");
			expect(result.current).toHaveProperty("isInitialized");
			expect(result.current).toHaveProperty("hasWallet");
		});
	});

	describe("useNeroConnect", () => {
		it("should throw error when used outside provider", async () => {
			const { useNeroConnect } = await import("../react");

			expect(() => {
				renderHook(() => useNeroConnect());
			}).toThrow(
				"useNeroMpcAuthContext must be used within a NeroMpcAuthProvider",
			);
		});

		it("should return connect functions and state", async () => {
			const { NeroMpcAuthProvider, useNeroConnect } = await import("../react");

			function Wrapper({ children }: { children: React.ReactNode }) {
				return React.createElement(NeroMpcAuthProvider, {
					config: mockConfig,
					children,
				});
			}

			const { result } = renderHook(() => useNeroConnect(), {
				wrapper: Wrapper,
			});

			expect(result.current.connect).toBeInstanceOf(Function);
			expect(result.current.handleCallback).toBeInstanceOf(Function);
			expect(result.current.isConnecting).toBe(false);
			expect(result.current.error).toBeNull();
		});

		it("should set isConnecting during connect call", async () => {
			const { NeroMpcAuthProvider, useNeroConnect } = await import("../react");
			const { NeroMpcSDK } = await import("../nero-sdk");

			let resolveConnect: () => void;
			const connectPromise = new Promise<void>((resolve) => {
				resolveConnect = resolve;
			});

			vi.mocked(NeroMpcSDK).mockImplementation(
				() =>
					createMockSDK({
						loginWithGoogle: vi.fn().mockReturnValue(connectPromise),
					}) as any,
			);

			function Wrapper({ children }: { children: React.ReactNode }) {
				return React.createElement(NeroMpcAuthProvider, {
					config: mockConfig,
					children,
				});
			}

			const { result } = renderHook(() => useNeroConnect(), {
				wrapper: Wrapper,
			});

			await waitFor(() => {
				expect(result.current.connect).toBeInstanceOf(Function);
			});

			let connectPromiseResult: Promise<void>;
			act(() => {
				connectPromiseResult = result.current.connect("google");
			});

			expect(result.current.isConnecting).toBe(true);

			await act(async () => {
				resolveConnect?.();
				await connectPromiseResult;
			});

			expect(result.current.isConnecting).toBe(false);
		});
	});

	describe("useNeroDisconnect", () => {
		it("should throw error when used outside provider", async () => {
			const { useNeroDisconnect } = await import("../react");

			expect(() => {
				renderHook(() => useNeroDisconnect());
			}).toThrow(
				"useNeroMpcAuthContext must be used within a NeroMpcAuthProvider",
			);
		});

		it("should return disconnect function and state", async () => {
			const { NeroMpcAuthProvider, useNeroDisconnect } = await import(
				"../react"
			);

			function Wrapper({ children }: { children: React.ReactNode }) {
				return React.createElement(NeroMpcAuthProvider, {
					config: mockConfig,
					children,
				});
			}

			const { result } = renderHook(() => useNeroDisconnect(), {
				wrapper: Wrapper,
			});

			expect(result.current.disconnect).toBeInstanceOf(Function);
			expect(result.current.isDisconnecting).toBe(false);
			expect(result.current.error).toBeNull();
		});

		it("should handle disconnect error", async () => {
			const { NeroMpcAuthProvider, useNeroDisconnect } = await import(
				"../react"
			);
			const { NeroMpcSDK } = await import("../nero-sdk");

			vi.mocked(NeroMpcSDK).mockImplementation(
				() =>
					createMockSDK({
						logout: vi.fn().mockRejectedValue(new Error("Logout failed")),
					}) as any,
			);

			function Wrapper({ children }: { children: React.ReactNode }) {
				return React.createElement(NeroMpcAuthProvider, {
					config: mockConfig,
					children,
				});
			}

			const { result } = renderHook(() => useNeroDisconnect(), {
				wrapper: Wrapper,
			});

			await waitFor(() => {
				expect(result.current.disconnect).toBeInstanceOf(Function);
			});

			await act(async () => {
				try {
					await result.current.disconnect();
				} catch {
					// Expected
				}
			});

			expect(result.current.error).toBeInstanceOf(Error);
			expect(result.current.error?.message).toBe("Logout failed");
		});
	});

	describe("useNeroUser", () => {
		it("should throw error when used outside provider", async () => {
			const { useNeroUser } = await import("../react");

			expect(() => {
				renderHook(() => useNeroUser());
			}).toThrow(
				"useNeroMpcAuthContext must be used within a NeroMpcAuthProvider",
			);
		});

		it("should return user state", async () => {
			const { NeroMpcAuthProvider, useNeroUser } = await import("../react");

			function Wrapper({ children }: { children: React.ReactNode }) {
				return React.createElement(NeroMpcAuthProvider, {
					config: mockConfig,
					children,
				});
			}

			const { result } = renderHook(() => useNeroUser(), { wrapper: Wrapper });

			expect(result.current).toHaveProperty("user");
			expect(result.current).toHaveProperty("isAuthenticated");
			expect(result.current.isAuthenticated).toBe(false);
			expect(result.current.user).toBeNull();
		});
	});

	describe("useNeroWallet", () => {
		it("should throw error when used outside provider", async () => {
			const { useNeroWallet } = await import("../react");

			expect(() => {
				renderHook(() => useNeroWallet());
			}).toThrow(
				"useNeroMpcAuthContext must be used within a NeroMpcAuthProvider",
			);
		});

		it("should return wallet functions and state", async () => {
			const { NeroMpcAuthProvider, useNeroWallet } = await import("../react");

			function Wrapper({ children }: { children: React.ReactNode }) {
				return React.createElement(NeroMpcAuthProvider, {
					config: mockConfig,
					children,
				});
			}

			const { result } = renderHook(() => useNeroWallet(), {
				wrapper: Wrapper,
			});

			expect(result.current.generateWallet).toBeInstanceOf(Function);
			expect(result.current.signMessage).toBeInstanceOf(Function);
			expect(result.current.signTypedData).toBeInstanceOf(Function);
			expect(result.current.wallet).toBeNull();
			expect(result.current.hasWallet).toBe(false);
			expect(result.current.isGenerating).toBe(false);
			expect(result.current.isSigning).toBe(false);
			expect(result.current.error).toBeNull();
		});

		it("should handle wallet generation", async () => {
			const { NeroMpcAuthProvider, useNeroWallet } = await import("../react");
			const { NeroMpcSDK } = await import("../nero-sdk");

			const mockWallet = {
				address: "0x1234567890abcdef1234567890abcdef12345678",
				publicKey: "0xpubkey",
			};

			vi.mocked(NeroMpcSDK).mockImplementation(
				() =>
					createMockSDK({
						generateWallet: vi.fn().mockResolvedValue(mockWallet),
					}) as any,
			);

			function Wrapper({ children }: { children: React.ReactNode }) {
				return React.createElement(NeroMpcAuthProvider, {
					config: mockConfig,
					children,
				});
			}

			const { result } = renderHook(() => useNeroWallet(), {
				wrapper: Wrapper,
			});

			await waitFor(() => {
				expect(result.current.generateWallet).toBeInstanceOf(Function);
			});

			let walletResult: any;
			await act(async () => {
				walletResult = await result.current.generateWallet();
			});

			expect(walletResult).toEqual(mockWallet);
		});

		it("should handle wallet generation error", async () => {
			const { NeroMpcAuthProvider, useNeroWallet } = await import("../react");
			const { NeroMpcSDK } = await import("../nero-sdk");

			vi.mocked(NeroMpcSDK).mockImplementation(
				() =>
					createMockSDK({
						generateWallet: vi
							.fn()
							.mockRejectedValue(new Error("Generation failed")),
					}) as any,
			);

			function Wrapper({ children }: { children: React.ReactNode }) {
				return React.createElement(NeroMpcAuthProvider, {
					config: mockConfig,
					children,
				});
			}

			const { result } = renderHook(() => useNeroWallet(), {
				wrapper: Wrapper,
			});

			await waitFor(() => {
				expect(result.current.generateWallet).toBeInstanceOf(Function);
			});

			await act(async () => {
				try {
					await result.current.generateWallet();
				} catch {
					// Expected
				}
			});

			expect(result.current.error).toBeInstanceOf(Error);
			expect(result.current.error?.message).toBe("Generation failed");
		});

		it("should handle message signing error when wallet not available", async () => {
			const { NeroMpcAuthProvider, useNeroWallet } = await import("../react");
			const { NeroMpcSDK } = await import("../nero-sdk");

			vi.mocked(NeroMpcSDK).mockImplementation(
				() =>
					createMockSDK({
						wallet: null,
					}) as any,
			);

			function Wrapper({ children }: { children: React.ReactNode }) {
				return React.createElement(NeroMpcAuthProvider, {
					config: mockConfig,
					children,
				});
			}

			const { result } = renderHook(() => useNeroWallet(), {
				wrapper: Wrapper,
			});

			await waitFor(() => {
				expect(result.current.signMessage).toBeInstanceOf(Function);
			});

			await expect(
				act(async () => {
					await result.current.signMessage("test");
				}),
			).rejects.toThrow("Wallet not available");
		});
	});

	describe("NeroMpcAuthProvider", () => {
		it("should initialize SDK on mount when autoConnect is true", async () => {
			const { NeroMpcAuthProvider, useNeroMpcAuth } = await import("../react");
			const { NeroMpcSDK } = await import("../nero-sdk");

			const mockInitialize = vi.fn().mockResolvedValue(undefined);
			vi.mocked(NeroMpcSDK).mockImplementation(
				() =>
					createMockSDK({
						initialize: mockInitialize,
					}) as any,
			);

			function Wrapper({ children }: { children: React.ReactNode }) {
				return React.createElement(NeroMpcAuthProvider, {
					config: mockConfig,
					children,
				});
			}

			renderHook(() => useNeroMpcAuth(), { wrapper: Wrapper });

			await waitFor(() => {
				expect(mockInitialize).toHaveBeenCalled();
			});
		});

		it("should not initialize SDK when autoConnect is false", async () => {
			const { NeroMpcAuthProvider, useNeroMpcAuth } = await import("../react");
			const { NeroMpcSDK } = await import("../nero-sdk");

			const mockInitialize = vi.fn().mockResolvedValue(undefined);
			vi.mocked(NeroMpcSDK).mockImplementation(
				() =>
					createMockSDK({
						initialize: mockInitialize,
					}) as any,
			);

			function Wrapper({ children }: { children: React.ReactNode }) {
				return React.createElement(NeroMpcAuthProvider, {
					config: mockConfig,
					autoConnect: false,
					children,
				});
			}

			renderHook(() => useNeroMpcAuth(), { wrapper: Wrapper });

			// Give it time to not call initialize
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(mockInitialize).not.toHaveBeenCalled();
		});

		it("should handle initialization error", async () => {
			const { NeroMpcAuthProvider, useNeroMpcAuth } = await import("../react");
			const { NeroMpcSDK } = await import("../nero-sdk");

			vi.mocked(NeroMpcSDK).mockImplementation(
				() =>
					createMockSDK({
						initialize: vi.fn().mockRejectedValue(new Error("Init failed")),
					}) as any,
			);

			function Wrapper({ children }: { children: React.ReactNode }) {
				return React.createElement(NeroMpcAuthProvider, {
					config: mockConfig,
					children,
				});
			}

			const { result } = renderHook(() => useNeroMpcAuth(), {
				wrapper: Wrapper,
			});

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false);
			});

			expect(result.current.error).toBeInstanceOf(Error);
			expect(result.current.error?.message).toBe("Init failed");
		});
	});
});
