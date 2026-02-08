import type { ProtocolMessage, ProtocolMessageType } from "../types";
import { SDKError } from "../types";

type MessageHandler = (message: ProtocolMessage) => void;
type ConnectionHandler = () => void;
type ErrorHandler = (error: Error) => void;

interface PendingMessage {
	message: ProtocolMessage;
	timestamp: number;
}

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];
const PING_INTERVAL = 30000;
const MESSAGE_QUEUE_MAX = 100;

export class WebSocketClient {
	private ws: WebSocket | null = null;
	private url: string;
	private accessToken: string | null = null;
	private messageHandlers = new Map<ProtocolMessageType, Set<MessageHandler>>();
	private globalHandlers = new Set<MessageHandler>();
	private onConnectHandlers = new Set<ConnectionHandler>();
	private onDisconnectHandlers = new Set<ConnectionHandler>();
	private onErrorHandlers = new Set<ErrorHandler>();
	private reconnectAttempt = 0;
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	private pingInterval: ReturnType<typeof setInterval> | null = null;
	private messageQueue: PendingMessage[] = [];
	private isConnecting = false;

	constructor(url: string) {
		this.url = url;
	}

	setAccessToken(token: string): void {
		this.accessToken = token;
	}

	async connect(): Promise<void> {
		if (this.ws?.readyState === WebSocket.OPEN) {
			return;
		}

		if (this.isConnecting) {
			return;
		}

		this.isConnecting = true;

		return new Promise((resolve, reject) => {
			const wsUrl = this.accessToken
				? `${this.url}?token=${encodeURIComponent(this.accessToken)}`
				: this.url;

			this.ws = new WebSocket(wsUrl);

			this.ws.onopen = () => {
				this.isConnecting = false;
				this.reconnectAttempt = 0;
				this.startPingInterval();
				this.flushMessageQueue();
				this.onConnectHandlers.forEach((handler) => handler());
				resolve();
			};

			this.ws.onmessage = (event) => {
				this.handleMessage(event.data);
			};

			this.ws.onerror = () => {
				const error = new Error("WebSocket error");
				this.onErrorHandlers.forEach((handler) => handler(error));
			};

			this.ws.onclose = (event) => {
				this.isConnecting = false;
				this.stopPingInterval();
				this.onDisconnectHandlers.forEach((handler) => handler());

				if (!event.wasClean) {
					this.scheduleReconnect();
				}

				if (this.isConnecting) {
					reject(new SDKError("Connection failed", "CONNECTION_FAILED"));
				}
			};
		});
	}

	disconnect(): void {
		this.stopReconnect();
		this.stopPingInterval();

		if (this.ws) {
			this.ws.close(1000, "Client disconnect");
			this.ws = null;
		}
	}

	isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	send(message: ProtocolMessage): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			this.queueMessage(message);
			return;
		}

		this.ws.send(JSON.stringify(message));
	}

	on(type: ProtocolMessageType, handler: MessageHandler): () => void {
		if (!this.messageHandlers.has(type)) {
			this.messageHandlers.set(type, new Set());
		}
		this.messageHandlers.get(type)?.add(handler);

		return () => {
			this.messageHandlers.get(type)?.delete(handler);
		};
	}

	onAny(handler: MessageHandler): () => void {
		this.globalHandlers.add(handler);
		return () => {
			this.globalHandlers.delete(handler);
		};
	}

	onConnect(handler: ConnectionHandler): () => void {
		this.onConnectHandlers.add(handler);
		return () => {
			this.onConnectHandlers.delete(handler);
		};
	}

	onDisconnect(handler: ConnectionHandler): () => void {
		this.onDisconnectHandlers.add(handler);
		return () => {
			this.onDisconnectHandlers.delete(handler);
		};
	}

	onError(handler: ErrorHandler): () => void {
		this.onErrorHandlers.add(handler);
		return () => {
			this.onErrorHandlers.delete(handler);
		};
	}

	waitForMessage(
		type: ProtocolMessageType,
		sessionId: string,
		timeout = 30000,
	): Promise<ProtocolMessage> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				unsubscribe();
				reject(new SDKError(`Timeout waiting for ${type}`, "MESSAGE_TIMEOUT"));
			}, timeout);

			const unsubscribe = this.on(type, (message) => {
				if (message.sessionId === sessionId) {
					clearTimeout(timer);
					unsubscribe();
					resolve(message);
				}
			});
		});
	}

	private handleMessage(data: string): void {
		let message: ProtocolMessage;

		try {
			message = JSON.parse(data);
		} catch {
			return;
		}

		if (message.type === ("pong" as ProtocolMessageType)) {
			return;
		}

		this.globalHandlers.forEach((handler) => handler(message));

		const typeHandlers = this.messageHandlers.get(message.type);
		if (typeHandlers) {
			typeHandlers.forEach((handler) => handler(message));
		}
	}

	private queueMessage(message: ProtocolMessage): void {
		if (this.messageQueue.length >= MESSAGE_QUEUE_MAX) {
			this.messageQueue.shift();
		}

		this.messageQueue.push({
			message,
			timestamp: Date.now(),
		});
	}

	private flushMessageQueue(): void {
		const now = Date.now();
		const validMessages = this.messageQueue.filter(
			(item) => now - item.timestamp < 60000,
		);

		this.messageQueue = [];

		for (const item of validMessages) {
			this.send(item.message);
		}
	}

	private scheduleReconnect(): void {
		if (this.reconnectTimeout) {
			return;
		}

		const delay =
			RECONNECT_DELAYS[
				Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)
			];

		this.reconnectTimeout = setTimeout(() => {
			this.reconnectTimeout = null;
			this.reconnectAttempt++;
			this.connect().catch(() => {});
		}, delay);
	}

	private stopReconnect(): void {
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
		this.reconnectAttempt = 0;
	}

	private startPingInterval(): void {
		this.pingInterval = setInterval(() => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				this.ws.send(JSON.stringify({ type: "ping" }));
			}
		}, PING_INTERVAL);
	}

	private stopPingInterval(): void {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}
	}
}
