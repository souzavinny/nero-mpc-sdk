import type React from "react";
import { useState } from "react";
import { useTheme } from "../../react/theme";
import type { WalletInfo } from "../../types";
import { Button } from "./Button";
import { Modal } from "./Modal";

export interface WalletModalProps {
	isOpen: boolean;
	onClose: () => void;
	walletInfo: WalletInfo | null;
	onDisconnect: () => Promise<void>;
	onCopyAddress?: (address: string) => void;
	onViewExplorer?: (address: string) => void;
}

export function WalletModal({
	isOpen,
	onClose,
	walletInfo,
	onDisconnect,
	onCopyAddress,
	onViewExplorer,
}: WalletModalProps): React.ReactElement {
	const { theme } = useTheme();
	const [isDisconnecting, setIsDisconnecting] = useState(false);
	const [copied, setCopied] = useState(false);

	if (!walletInfo) {
		return (
			<Modal isOpen={isOpen} onClose={onClose} title="Wallet">
				<div style={{ textAlign: "center", color: theme.colors.textMuted }}>
					No wallet connected
				</div>
			</Modal>
		);
	}

	const handleCopy = async () => {
		const address = walletInfo.smartWalletAddress ?? walletInfo.eoaAddress;
		try {
			await navigator.clipboard.writeText(address);
			setCopied(true);
			onCopyAddress?.(address);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard API not available
		}
	};

	const handleDisconnect = async () => {
		setIsDisconnecting(true);
		try {
			await onDisconnect();
			onClose();
		} finally {
			setIsDisconnecting(false);
		}
	};

	const truncateAddress = (address: string) => {
		return `${address.slice(0, 6)}...${address.slice(-4)}`;
	};

	const containerStyle: React.CSSProperties = {
		display: "flex",
		flexDirection: "column",
		gap: theme.spacing.lg,
	};

	const addressContainerStyle: React.CSSProperties = {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		padding: theme.spacing.lg,
		backgroundColor: theme.colors.backgroundSecondary,
		borderRadius: theme.borderRadius.lg,
	};

	const walletIconStyle: React.CSSProperties = {
		width: "64px",
		height: "64px",
		borderRadius: theme.borderRadius.full,
		backgroundColor: theme.colors.primary,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: theme.spacing.md,
		color: "#ffffff",
		fontSize: "24px",
		fontWeight: theme.typography.fontWeightBold,
	};

	const addressStyle: React.CSSProperties = {
		fontFamily: theme.typography.fontFamilyMono,
		fontSize: theme.typography.fontSizeMd,
		color: theme.colors.text,
		marginBottom: theme.spacing.xs,
	};

	const labelStyle: React.CSSProperties = {
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeXs,
		color: theme.colors.textMuted,
		textTransform: "uppercase",
		letterSpacing: "0.05em",
	};

	const actionsStyle: React.CSSProperties = {
		display: "flex",
		gap: theme.spacing.sm,
	};

	const infoRowStyle: React.CSSProperties = {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		padding: theme.spacing.sm,
		backgroundColor: theme.colors.backgroundSecondary,
		borderRadius: theme.borderRadius.md,
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeSm,
	};

	const displayAddress = walletInfo.smartWalletAddress ?? walletInfo.eoaAddress;

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Wallet">
			<div style={containerStyle}>
				<div style={addressContainerStyle}>
					<div style={walletIconStyle}>
						{displayAddress.slice(2, 4).toUpperCase()}
					</div>
					<span style={labelStyle}>
						{walletInfo.smartWalletAddress ? "Smart Account" : "EOA Address"}
					</span>
					<span style={addressStyle}>{truncateAddress(displayAddress)}</span>
					<div style={actionsStyle}>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleCopy}
							leftIcon={<CopyIcon />}
						>
							{copied ? "Copied!" : "Copy"}
						</Button>
						{onViewExplorer && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onViewExplorer(displayAddress)}
								leftIcon={<ExternalLinkIcon />}
							>
								Explorer
							</Button>
						)}
					</div>
				</div>

				{walletInfo.smartWalletAddress && (
					<div style={infoRowStyle}>
						<span style={{ color: theme.colors.textMuted }}>EOA Address</span>
						<span style={{ fontFamily: theme.typography.fontFamilyMono }}>
							{truncateAddress(walletInfo.eoaAddress)}
						</span>
					</div>
				)}

				<div style={infoRowStyle}>
					<span style={{ color: theme.colors.textMuted }}>Chain ID</span>
					<span>{walletInfo.chainId}</span>
				</div>

				<Button
					variant="outline"
					onClick={handleDisconnect}
					isLoading={isDisconnecting}
					fullWidth
				>
					Disconnect
				</Button>
			</div>
		</Modal>
	);
}

function CopyIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
			<path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
		</svg>
	);
}

function ExternalLinkIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
			<polyline points="15 3 21 3 21 9" />
			<line x1="10" y1="14" x2="21" y2="3" />
		</svg>
	);
}
