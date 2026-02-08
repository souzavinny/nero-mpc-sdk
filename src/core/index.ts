export {
	ClientKeyManager,
	generateDeviceKey,
	deriveDeviceKey,
	type KeyManagerConfig,
} from "./client-key-manager";

export {
	SecureKeyStorage,
	IndexedDBStorage,
	MemoryStorage,
	createSecureStorage,
} from "./secure-storage";

export {
	encryptWithPassword,
	decryptWithPassword,
	encryptWithKey,
	decryptWithKey,
	deriveKeyFromPassword,
	deriveKeyFromDeviceInfo,
	generateRandomBytes,
	generateRandomHex,
	hashSha256,
	computeCommitment,
	bytesToHex,
	hexToBytes,
	utf8ToBytes,
	type EncryptionResult,
} from "./crypto-primitives";

export {
	NeroProvider,
	createNeroProvider,
	type NeroProviderConfig,
} from "./provider";

export {
	type EIP1193Provider,
	type RequestArguments,
	type ProviderRpcError,
	type ProviderConnectInfo,
	type ProviderMessage,
	type AddEthereumChainParameter,
	type WatchAssetParams,
	type TransactionParams,
	type TypedDataDomain,
	type TypedDataField,
	type TypedDataTypes,
	type TypedDataMessage,
	EIP1193_ERROR_CODES,
	createProviderRpcError,
} from "./provider-types";
