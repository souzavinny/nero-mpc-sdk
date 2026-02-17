import type React from "react";
import { type ReactNode, useCallback, useEffect } from "react";
import { useTheme } from "../../react/theme";

const FADE_IN_CSS_ID = "nero-modal-animations";

function injectAnimations() {
	if (typeof document === "undefined") return;
	if (document.getElementById(FADE_IN_CSS_ID)) return;

	const style = document.createElement("style");
	style.id = FADE_IN_CSS_ID;
	style.textContent = `
@keyframes nero-overlay-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes nero-modal-slide-up {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}`;
	document.head.appendChild(style);
}

export interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	children: ReactNode;
	title?: string;
	onBack?: () => void;
	closeOnOverlayClick?: boolean;
	closeOnEscape?: boolean;
	width?: string;
}

export function Modal({
	isOpen,
	onClose,
	children,
	title,
	onBack,
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
		injectAnimations();
	}, []);

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
		zIndex: 2147483647,
		padding: theme.spacing.md,
		animation: "nero-overlay-fade-in 0.2s ease-out",
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
		animation: "nero-modal-slide-up 0.25s ease-out",
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

	const navButtonStyle: React.CSSProperties = {
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

	const standaloneCloseStyle: React.CSSProperties = {
		...navButtonStyle,
		position: "absolute",
		top: theme.spacing.md,
		right: theme.spacing.md,
		zIndex: 1,
	};

	const contentStyle: React.CSSProperties = {
		padding: theme.spacing.lg,
	};

	const closeSvg = (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
			<path
				d="M15 5L5 15M5 5L15 15"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);

	const backSvg = (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
			<path
				d="M13 4L7 10L13 16"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);

	return (
		<div style={overlayStyle} onClick={handleOverlayClick}>
			<div
				style={modalStyle}
				role="dialog"
				aria-modal="true"
				aria-labelledby={title ? "modal-title" : undefined}
			>
				{title ? (
					<div style={headerStyle}>
						{onBack ? (
							<button
								style={navButtonStyle}
								onClick={onBack}
								aria-label="Go back"
							>
								{backSvg}
							</button>
						) : (
							<div style={{ width: "28px" }} />
						)}
						<h2 id="modal-title" style={titleStyle}>
							{title}
						</h2>
						<button
							style={navButtonStyle}
							onClick={onClose}
							aria-label="Close modal"
						>
							{closeSvg}
						</button>
					</div>
				) : (
					<button
						style={standaloneCloseStyle}
						onClick={onClose}
						aria-label="Close modal"
					>
						{closeSvg}
					</button>
				)}
				<div style={contentStyle}>{children}</div>
			</div>
		</div>
	);
}
