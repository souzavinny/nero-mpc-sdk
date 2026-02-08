import type React from "react";
import { type ReactNode, useCallback, useEffect } from "react";
import { useTheme } from "../../react/theme";

export interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	children: ReactNode;
	title?: string;
	closeOnOverlayClick?: boolean;
	closeOnEscape?: boolean;
	width?: string;
}

export function Modal({
	isOpen,
	onClose,
	children,
	title,
	closeOnOverlayClick = true,
	closeOnEscape = true,
	width = "400px",
}: ModalProps): React.ReactElement | null {
	const { theme } = useTheme();

	const handleEscape = useCallback(
		(e: KeyboardEvent) => {
			if (closeOnEscape && e.key === "Escape") {
				onClose();
			}
		},
		[closeOnEscape, onClose],
	);

	useEffect(() => {
		if (isOpen) {
			document.addEventListener("keydown", handleEscape);
			document.body.style.overflow = "hidden";
		}

		return () => {
			document.removeEventListener("keydown", handleEscape);
			document.body.style.overflow = "";
		};
	}, [isOpen, handleEscape]);

	if (!isOpen) return null;

	const handleOverlayClick = (e: React.MouseEvent) => {
		if (closeOnOverlayClick && e.target === e.currentTarget) {
			onClose();
		}
	};

	const overlayStyle: React.CSSProperties = {
		position: "fixed",
		inset: 0,
		backgroundColor: theme.colors.overlay,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		zIndex: 9999,
		padding: theme.spacing.md,
	};

	const modalStyle: React.CSSProperties = {
		backgroundColor: theme.colors.surface,
		borderRadius: theme.borderRadius.xl,
		boxShadow: theme.shadows.xl,
		maxWidth: width,
		width: "100%",
		maxHeight: "90vh",
		overflow: "auto",
		position: "relative",
	};

	const headerStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: theme.spacing.lg,
		borderBottom: `1px solid ${theme.colors.border}`,
	};

	const titleStyle: React.CSSProperties = {
		fontFamily: theme.typography.fontFamily,
		fontSize: theme.typography.fontSizeLg,
		fontWeight: theme.typography.fontWeightSemibold,
		color: theme.colors.text,
		margin: 0,
	};

	const closeButtonStyle: React.CSSProperties = {
		background: "none",
		border: "none",
		cursor: "pointer",
		padding: theme.spacing.xs,
		borderRadius: theme.borderRadius.md,
		color: theme.colors.textMuted,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	};

	const contentStyle: React.CSSProperties = {
		padding: theme.spacing.lg,
	};

	return (
		<div style={overlayStyle} onClick={handleOverlayClick}>
			<div
				style={modalStyle}
				role="dialog"
				aria-modal="true"
				aria-labelledby={title ? "modal-title" : undefined}
			>
				{title && (
					<div style={headerStyle}>
						<h2 id="modal-title" style={titleStyle}>
							{title}
						</h2>
						<button
							style={closeButtonStyle}
							onClick={onClose}
							aria-label="Close modal"
						>
							<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
								<path
									d="M15 5L5 15M5 5L15 15"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						</button>
					</div>
				)}
				<div style={contentStyle}>{children}</div>
			</div>
		</div>
	);
}
