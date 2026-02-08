import type React from "react";
import { useState } from "react";
import { Modal } from "../../../modal/components/Modal";
import { useTheme } from "../../../react/theme";
import type { WalletInfo } from "../../../types";
import type { TokenBalance, TransactionHistoryItem } from "../types";

export interface WalletUIProps {
	isOpen: boolean;
	onClose: () => void;
	walletInfo: WalletInfo | null;
	tokens?: TokenBalance[];
	transactions?: TransactionHistoryItem[];
	onSend?: () => void;
	onReceive?: () => void;
	onFunding?: () => void;
	onSwap?: () => void;
}

type TabId = "tokens" | "activity";

export function WalletUI({
	isOpen,
	onClose,
	walletInfo,
	tokens = [],
	transactions = [],
	onSend,
	onReceive,
	onFunding,
	onSwap,
}: WalletUIProps): React.ReactElement {
	const { theme } = useTheme();
	const [activeTab, setActiveTab] = useState<TabId>("tokens");

	if (!walletInfo) {
		return (
			<Modal isOpen={isOpen} onClose={onClose} title="Wallet" width="450px">
				<div style={{ textAlign: "center", color: theme.colors.textMuted }}>
					No wallet connected
				</div>
			</Modal>
		);
	}

	const containerStyle: React.CSSProperties = {
		display: "flex",
		flexDirection: "column",
		gap: theme.spacing.lg,
	};

	const balanceStyle: React.CSSProperties = {
		textAlign: "center",
		padding: theme.spacing.lg,
	};

	const balanceValueStyle: React.CSSProperties = {
		fontFamily: theme.typography.fontFamily,
		fontSize: "2rem",
		fontWeight: theme.typography.fontWeightBold,
		color: theme.colors.text,
		margin: 0,
	};

	const balanceLabelStyle: React.CSSProperties = {
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeSm,
		color: theme.colors.textMuted,
		marginTop: theme.spacing.xs,
	};

	const actionsStyle: React.CSSProperties = {
		display: "grid",
		gridTemplateColumns: "repeat(4, 1fr)",
		gap: theme.spacing.sm,
	};

	const actionButtonStyle: React.CSSProperties = {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		gap: theme.spacing.xs,
		padding: theme.spacing.md,
		backgroundColor: theme.colors.backgroundSecondary,
		border: "none",
		borderRadius: theme.borderRadius.lg,
		cursor: "pointer",
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeXs,
		color: theme.colors.text,
		transition: "background-color 0.2s",
	};

	const tabsStyle: React.CSSProperties = {
		display: "flex",
		borderBottom: `1px solid ${theme.colors.border}`,
	};

	const tabStyle = (isActive: boolean): React.CSSProperties => ({
		flex: 1,
		padding: theme.spacing.md,
		backgroundColor: "transparent",
		border: "none",
		borderBottom: isActive
			? `2px solid ${theme.colors.primary}`
			: "2px solid transparent",
		cursor: "pointer",
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeSm,
		fontWeight: isActive
			? theme.typography.fontWeightSemibold
			: theme.typography.fontWeightNormal,
		color: isActive ? theme.colors.primary : theme.colors.textMuted,
	});

	const totalBalance = tokens.reduce((acc, token) => {
		return acc + Number.parseFloat(token.valueUsd ?? "0");
	}, 0);

	return (
		<Modal isOpen={isOpen} onClose={onClose} width="450px">
			<div style={containerStyle}>
				<div style={balanceStyle}>
					<p style={balanceValueStyle}>${totalBalance.toFixed(2)}</p>
					<p style={balanceLabelStyle}>Total Balance</p>
				</div>

				<div style={actionsStyle}>
					<button
						style={actionButtonStyle}
						onClick={onSend}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor =
								theme.colors.backgroundSecondary;
						}}
					>
						<SendIcon />
						Send
					</button>
					<button
						style={actionButtonStyle}
						onClick={onReceive}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor =
								theme.colors.backgroundSecondary;
						}}
					>
						<ReceiveIcon />
						Receive
					</button>
					<button
						style={actionButtonStyle}
						onClick={onFunding}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor =
								theme.colors.backgroundSecondary;
						}}
					>
						<FundingIcon />
						Buy
					</button>
					<button
						style={actionButtonStyle}
						onClick={onSwap}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor =
								theme.colors.backgroundSecondary;
						}}
					>
						<SwapIcon />
						Swap
					</button>
				</div>

				<div style={tabsStyle}>
					<button
						style={tabStyle(activeTab === "tokens")}
						onClick={() => setActiveTab("tokens")}
					>
						Tokens
					</button>
					<button
						style={tabStyle(activeTab === "activity")}
						onClick={() => setActiveTab("activity")}
					>
						Activity
					</button>
				</div>

				{activeTab === "tokens" ? (
					<TokenList tokens={tokens} />
				) : (
					<TransactionList transactions={transactions} />
				)}
			</div>
		</Modal>
	);
}

function TokenList({ tokens }: { tokens: TokenBalance[] }) {
	const { theme } = useTheme();

	const listStyle: React.CSSProperties = {
		display: "flex",
		flexDirection: "column",
		gap: theme.spacing.xs,
		maxHeight: "300px",
		overflowY: "auto",
	};

	const emptyStyle: React.CSSProperties = {
		textAlign: "center",
		padding: theme.spacing.xl,
		color: theme.colors.textMuted,
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeSm,
	};

	if (tokens.length === 0) {
		return <div style={emptyStyle}>No tokens found</div>;
	}

	return (
		<div style={listStyle}>
			{tokens.map((token) => (
				<TokenRow key={token.address} token={token} />
			))}
		</div>
	);
}

function TokenRow({ token }: { token: TokenBalance }) {
	const { theme } = useTheme();

	const rowStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: theme.spacing.md,
		backgroundColor: theme.colors.backgroundSecondary,
		borderRadius: theme.borderRadius.md,
	};

	const leftStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing.sm,
	};

	const iconStyle: React.CSSProperties = {
		width: "36px",
		height: "36px",
		borderRadius: theme.borderRadius.full,
		backgroundColor: theme.colors.primary,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		color: "#ffffff",
		fontWeight: theme.typography.fontWeightBold,
		fontSize: theme.typography.fontSizeSm,
	};

	const nameStyle: React.CSSProperties = {
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeSm,
		fontWeight: theme.typography.fontWeightMedium,
		color: theme.colors.text,
	};

	const symbolStyle: React.CSSProperties = {
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeXs,
		color: theme.colors.textMuted,
	};

	const rightStyle: React.CSSProperties = {
		textAlign: "right",
	};

	const balanceStyle: React.CSSProperties = {
		fontFamily: theme.typography.fontFamilyMono,
		fontSize: theme.typography.fontSizeSm,
		color: theme.colors.text,
	};

	const valueStyle: React.CSSProperties = {
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeXs,
		color: theme.colors.textMuted,
	};

	const formattedBalance =
		Number.parseFloat(token.balance) / 10 ** token.decimals;

	return (
		<div style={rowStyle}>
			<div style={leftStyle}>
				{token.logoUrl ? (
					<img
						src={token.logoUrl}
						alt={token.symbol}
						style={{ ...iconStyle, backgroundColor: "transparent" }}
					/>
				) : (
					<div style={iconStyle}>{token.symbol.slice(0, 2)}</div>
				)}
				<div>
					<div style={nameStyle}>{token.name}</div>
					<div style={symbolStyle}>{token.symbol}</div>
				</div>
			</div>
			<div style={rightStyle}>
				<div style={balanceStyle}>{formattedBalance.toFixed(4)}</div>
				{token.valueUsd && <div style={valueStyle}>${token.valueUsd}</div>}
			</div>
		</div>
	);
}

function TransactionList({
	transactions,
}: { transactions: TransactionHistoryItem[] }) {
	const { theme } = useTheme();

	const emptyStyle: React.CSSProperties = {
		textAlign: "center",
		padding: theme.spacing.xl,
		color: theme.colors.textMuted,
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeSm,
	};

	if (transactions.length === 0) {
		return <div style={emptyStyle}>No transactions yet</div>;
	}

	return (
		<div>
			{transactions.map((tx) => (
				<div key={tx.hash}>{tx.hash.slice(0, 10)}...</div>
			))}
		</div>
	);
}

function SendIcon() {
	return (
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<line x1="12" y1="19" x2="12" y2="5" />
			<polyline points="5 12 12 5 19 12" />
		</svg>
	);
}

function ReceiveIcon() {
	return (
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<line x1="12" y1="5" x2="12" y2="19" />
			<polyline points="19 12 12 19 5 12" />
		</svg>
	);
}

function FundingIcon() {
	return (
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<rect x="2" y="4" width="20" height="16" rx="2" />
			<line x1="2" y1="10" x2="22" y2="10" />
		</svg>
	);
}

function SwapIcon() {
	return (
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<polyline points="17 1 21 5 17 9" />
			<path d="M3 11V9a4 4 0 014-4h14" />
			<polyline points="7 23 3 19 7 15" />
			<path d="M21 13v2a4 4 0 01-4 4H3" />
		</svg>
	);
}
