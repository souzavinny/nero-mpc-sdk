export interface UserOperation {
	sender: string;
	nonce: bigint;
	initCode: string;
	callData: string;
	callGasLimit: bigint;
	verificationGasLimit: bigint;
	preVerificationGas: bigint;
	maxFeePerGas: bigint;
	maxPriorityFeePerGas: bigint;
	paymasterAndData: string;
	signature: string;
}

export interface UserOperationHex {
	sender: string;
	nonce: string;
	initCode: string;
	callData: string;
	callGasLimit: string;
	verificationGasLimit: string;
	preVerificationGas: string;
	maxFeePerGas: string;
	maxPriorityFeePerGas: string;
	paymasterAndData: string;
	signature: string;
}

export interface GasEstimate {
	preVerificationGas: bigint;
	verificationGasLimit: bigint;
	callGasLimit: bigint;
}

export interface UserOperationReceipt {
	userOpHash: string;
	entryPoint: string;
	sender: string;
	nonce: string;
	paymaster: string;
	actualGasCost: string;
	actualGasUsed: string;
	success: boolean;
	logs: Array<{
		address: string;
		topics: string[];
		data: string;
	}>;
	receipt: {
		transactionHash: string;
		transactionIndex: string;
		blockHash: string;
		blockNumber: string;
		from: string;
		to: string;
		gasUsed: string;
		status: string;
	};
}

export interface PaymasterResult {
	paymasterAndData: string;
	preVerificationGas?: bigint;
	verificationGasLimit?: bigint;
	callGasLimit?: bigint;
}

export interface PaymasterContext {
	mode?: "free" | "sponsored" | "erc20";
	token?: string;
	sponsorId?: string;
}

export interface SimpleAccountFactoryData {
	factoryAddress: string;
	ownerAddress: string;
	salt: bigint;
}

export function userOpToHex(userOp: UserOperation): UserOperationHex {
	return {
		sender: userOp.sender,
		nonce: `0x${userOp.nonce.toString(16)}`,
		initCode: userOp.initCode,
		callData: userOp.callData,
		callGasLimit: `0x${userOp.callGasLimit.toString(16)}`,
		verificationGasLimit: `0x${userOp.verificationGasLimit.toString(16)}`,
		preVerificationGas: `0x${userOp.preVerificationGas.toString(16)}`,
		maxFeePerGas: `0x${userOp.maxFeePerGas.toString(16)}`,
		maxPriorityFeePerGas: `0x${userOp.maxPriorityFeePerGas.toString(16)}`,
		paymasterAndData: userOp.paymasterAndData,
		signature: userOp.signature,
	};
}

export function userOpFromHex(userOpHex: UserOperationHex): UserOperation {
	return {
		sender: userOpHex.sender,
		nonce: BigInt(userOpHex.nonce),
		initCode: userOpHex.initCode,
		callData: userOpHex.callData,
		callGasLimit: BigInt(userOpHex.callGasLimit),
		verificationGasLimit: BigInt(userOpHex.verificationGasLimit),
		preVerificationGas: BigInt(userOpHex.preVerificationGas),
		maxFeePerGas: BigInt(userOpHex.maxFeePerGas),
		maxPriorityFeePerGas: BigInt(userOpHex.maxPriorityFeePerGas),
		paymasterAndData: userOpHex.paymasterAndData,
		signature: userOpHex.signature,
	};
}
