import type React from "react";
import { useState } from "react";
import { Button } from "../../../modal/components/Button";
import { Modal } from "../../../modal/components/Modal";
import { useTheme } from "../../../react/theme";

export interface ReceiveModalProps {
	isOpen: boolean;
	onClose: () => void;
	address: string;
	chainName?: string;
}

export function ReceiveModal({
	isOpen,
	onClose,
	address,
	chainName = "NERO",
}: ReceiveModalProps): React.ReactElement {
	const { theme } = useTheme();
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(address);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard API not available
		}
	};

	const containerStyle: React.CSSProperties = {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		gap: theme.spacing.lg,
	};

	const qrContainerStyle: React.CSSProperties = {
		padding: theme.spacing.lg,
		backgroundColor: "#ffffff",
		borderRadius: theme.borderRadius.lg,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	};

	const labelStyle: React.CSSProperties = {
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeSm,
		color: theme.colors.textMuted,
		textAlign: "center",
	};

	const addressContainerStyle: React.CSSProperties = {
		width: "100%",
		padding: theme.spacing.md,
		backgroundColor: theme.colors.backgroundSecondary,
		borderRadius: theme.borderRadius.md,
		border: `1px solid ${theme.colors.border}`,
	};

	const addressStyle: React.CSSProperties = {
		fontFamily: theme.typography.fontFamilyMono,
		fontSize: theme.typography.fontSizeSm,
		color: theme.colors.text,
		wordBreak: "break-all",
		textAlign: "center",
	};

	const warningStyle: React.CSSProperties = {
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeXs,
		color: theme.colors.warning,
		textAlign: "center",
		padding: theme.spacing.sm,
		backgroundColor: theme.colors.warningBackground,
		borderRadius: theme.borderRadius.md,
		width: "100%",
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Receive" width="380px">
			<div style={containerStyle}>
				<div style={qrContainerStyle}>
					<QRCodePlaceholder address={address} />
				</div>

				<p style={labelStyle}>
					Scan QR code or copy address to receive tokens on {chainName}
				</p>

				<div style={addressContainerStyle}>
					<p style={addressStyle}>{address}</p>
				</div>

				<Button onClick={handleCopy} fullWidth>
					{copied ? "Copied!" : "Copy Address"}
				</Button>

				<p style={warningStyle}>
					Only send {chainName} compatible tokens to this address
				</p>
			</div>
		</Modal>
	);
}

function QRCodePlaceholder({ address }: { address: string }) {
	const size = 180;
	const moduleCount = 25;
	const moduleSize = size / moduleCount;

	const hash = simpleHash(address);
	const modules: boolean[][] = [];

	for (let row = 0; row < moduleCount; row++) {
		modules[row] = [];
		for (let col = 0; col < moduleCount; col++) {
			const isFinderPattern =
				(row < 7 && col < 7) ||
				(row < 7 && col >= moduleCount - 7) ||
				(row >= moduleCount - 7 && col < 7);

			if (isFinderPattern) {
				modules[row][col] = isFinderModule(row % 7, col % 7);
			} else {
				modules[row][col] = (hash + row * col) % 3 === 0;
			}
		}
	}

	return (
		<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
			{modules.map((row, rowIndex) =>
				row.map((module, colIndex) =>
					module ? (
						<rect
							key={`${rowIndex}-${colIndex}`}
							x={colIndex * moduleSize}
							y={rowIndex * moduleSize}
							width={moduleSize}
							height={moduleSize}
							fill="#000000"
						/>
					) : null,
				),
			)}
		</svg>
	);
}

function isFinderModule(row: number, col: number): boolean {
	if (row === 0 || row === 6 || col === 0 || col === 6) return true;
	if (row >= 2 && row <= 4 && col >= 2 && col <= 4) return true;
	return false;
}

function simpleHash(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash = hash & hash;
	}
	return Math.abs(hash);
}
