import { describe, expect, it } from "vitest";
import {
	ARBITRUM_ONE,
	BASE_MAINNET,
	ETHEREUM_MAINNET,
	ETHEREUM_SEPOLIA,
	NERO_MAINNET,
	NERO_TESTNET,
	POLYGON_MAINNET,
	getAllChains,
	getChainConfig,
	getMainnetChains,
	getTestnetChains,
} from "../chains";
import type { ChainConfig } from "../chains";

describe("Chain Configurations", () => {
	describe("NERO_TESTNET", () => {
		it("should have correct chain ID", () => {
			expect(NERO_TESTNET.chainId).toBe(689);
		});

		it("should have valid RPC URLs", () => {
			expect(NERO_TESTNET.rpcUrls.length).toBeGreaterThan(0);
			expect(NERO_TESTNET.rpcUrls[0]).toMatch(/^https?:\/\//);
		});

		it("should have bundler and paymaster URLs", () => {
			expect(NERO_TESTNET.bundlerUrl).toBeDefined();
			expect(NERO_TESTNET.paymasterUrl).toBeDefined();
		});

		it("should have correct native currency", () => {
			expect(NERO_TESTNET.nativeCurrency).toEqual({
				name: "NERO",
				symbol: "NERO",
				decimals: 18,
			});
		});

		it("should be a testnet", () => {
			expect(NERO_TESTNET.isTestnet).toBe(true);
		});

		it("should have entry point address", () => {
			expect(NERO_TESTNET.entryPointAddress).toBeDefined();
			expect(NERO_TESTNET.entryPointAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
		});

		it("should have simple account factory address", () => {
			expect(NERO_TESTNET.simpleAccountFactoryAddress).toBeDefined();
			expect(NERO_TESTNET.simpleAccountFactoryAddress).toMatch(
				/^0x[a-fA-F0-9]{40}$/,
			);
		});
	});

	describe("NERO_MAINNET", () => {
		it("should have correct chain ID", () => {
			expect(NERO_MAINNET.chainId).toBe(1689);
		});

		it("should not be a testnet", () => {
			expect(NERO_MAINNET.isTestnet).toBe(false);
		});

		it("should have explorer URLs", () => {
			expect(NERO_MAINNET.blockExplorerUrls).toBeDefined();
			expect(NERO_MAINNET.blockExplorerUrls?.length).toBeGreaterThan(0);
		});
	});

	describe("ETHEREUM_MAINNET", () => {
		it("should have correct chain ID", () => {
			expect(ETHEREUM_MAINNET.chainId).toBe(1);
		});

		it("should have ETH as native currency", () => {
			expect(ETHEREUM_MAINNET.nativeCurrency.symbol).toBe("ETH");
		});

		it("should not be a testnet", () => {
			expect(ETHEREUM_MAINNET.isTestnet).toBe(false);
		});
	});

	describe("ETHEREUM_SEPOLIA", () => {
		it("should have correct chain ID", () => {
			expect(ETHEREUM_SEPOLIA.chainId).toBe(11155111);
		});

		it("should be a testnet", () => {
			expect(ETHEREUM_SEPOLIA.isTestnet).toBe(true);
		});
	});

	describe("POLYGON_MAINNET", () => {
		it("should have correct chain ID", () => {
			expect(POLYGON_MAINNET.chainId).toBe(137);
		});

		it("should have MATIC as native currency", () => {
			expect(POLYGON_MAINNET.nativeCurrency.symbol).toBe("MATIC");
		});
	});

	describe("ARBITRUM_ONE", () => {
		it("should have correct chain ID", () => {
			expect(ARBITRUM_ONE.chainId).toBe(42161);
		});

		it("should have ETH as native currency", () => {
			expect(ARBITRUM_ONE.nativeCurrency.symbol).toBe("ETH");
		});
	});

	describe("BASE_MAINNET", () => {
		it("should have correct chain ID", () => {
			expect(BASE_MAINNET.chainId).toBe(8453);
		});

		it("should have ETH as native currency", () => {
			expect(BASE_MAINNET.nativeCurrency.symbol).toBe("ETH");
		});
	});

	describe("getChainConfig", () => {
		it("should return NERO_TESTNET for chain ID 689", () => {
			const chain = getChainConfig(689);
			expect(chain).toEqual(NERO_TESTNET);
		});

		it("should return NERO_MAINNET for chain ID 1689", () => {
			const chain = getChainConfig(1689);
			expect(chain).toEqual(NERO_MAINNET);
		});

		it("should return ETHEREUM_MAINNET for chain ID 1", () => {
			const chain = getChainConfig(1);
			expect(chain).toEqual(ETHEREUM_MAINNET);
		});

		it("should return undefined for unknown chain ID", () => {
			const chain = getChainConfig(99999);
			expect(chain).toBeUndefined();
		});
	});

	describe("getAllChains", () => {
		it("should return all configured chains", () => {
			const chains = getAllChains();
			expect(chains.length).toBe(7);
		});

		it("should include NERO chains", () => {
			const chains = getAllChains();
			const neroChains = chains.filter(
				(c: ChainConfig) => c.chainId === 689 || c.chainId === 1689,
			);
			expect(neroChains.length).toBe(2);
		});

		it("should return ChainConfig objects", () => {
			const chains = getAllChains();
			chains.forEach((chain: ChainConfig) => {
				expect(chain).toHaveProperty("chainId");
				expect(chain).toHaveProperty("chainName");
				expect(chain).toHaveProperty("rpcUrls");
				expect(chain).toHaveProperty("nativeCurrency");
			});
		});
	});

	describe("getTestnetChains", () => {
		it("should return only testnet chains", () => {
			const testnets = getTestnetChains();
			testnets.forEach((chain: ChainConfig) => {
				expect(chain.isTestnet).toBe(true);
			});
		});

		it("should include NERO Testnet and Sepolia", () => {
			const testnets = getTestnetChains();
			const chainIds = testnets.map((c: ChainConfig) => c.chainId);
			expect(chainIds).toContain(689);
			expect(chainIds).toContain(11155111);
		});
	});

	describe("getMainnetChains", () => {
		it("should return only mainnet chains", () => {
			const mainnets = getMainnetChains();
			mainnets.forEach((chain: ChainConfig) => {
				expect(chain.isTestnet).toBe(false);
			});
		});

		it("should include NERO Mainnet and Ethereum", () => {
			const mainnets = getMainnetChains();
			const chainIds = mainnets.map((c: ChainConfig) => c.chainId);
			expect(chainIds).toContain(1689);
			expect(chainIds).toContain(1);
		});
	});

	describe("Chain configuration structure", () => {
		const allChains = [
			NERO_TESTNET,
			NERO_MAINNET,
			ETHEREUM_MAINNET,
			ETHEREUM_SEPOLIA,
			POLYGON_MAINNET,
			ARBITRUM_ONE,
			BASE_MAINNET,
		];

		it("all chains should have required fields", () => {
			allChains.forEach((chain) => {
				expect(typeof chain.chainId).toBe("number");
				expect(typeof chain.chainName).toBe("string");
				expect(typeof chain.displayName).toBe("string");
				expect(Array.isArray(chain.rpcUrls)).toBe(true);
				expect(chain.rpcUrls.length).toBeGreaterThan(0);
				expect(chain.nativeCurrency).toBeDefined();
				expect(typeof chain.nativeCurrency.name).toBe("string");
				expect(typeof chain.nativeCurrency.symbol).toBe("string");
				expect(typeof chain.nativeCurrency.decimals).toBe("number");
			});
		});

		it("all chains should have unique chain IDs", () => {
			const chainIds = allChains.map((c) => c.chainId);
			const uniqueIds = new Set(chainIds);
			expect(uniqueIds.size).toBe(chainIds.length);
		});

		it("all chains should have 18 decimal native currency", () => {
			allChains.forEach((chain) => {
				expect(chain.nativeCurrency.decimals).toBe(18);
			});
		});

		it("all chains should have entry point address", () => {
			allChains.forEach((chain) => {
				expect(chain.entryPointAddress).toBeDefined();
				expect(chain.entryPointAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
			});
		});
	});
});
