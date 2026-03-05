import type { ConnectionStatus } from "../nero-sdk";

type TransitionMap = Record<ConnectionStatus, ConnectionStatus[]>;

const VALID_TRANSITIONS: TransitionMap = {
	disconnected: ["connecting"],
	connecting: ["connected", "errored"],
	connected: ["disconnected"],
	errored: ["connecting", "disconnected"],
};

export class ConnectionStateMachine {
	private _state: ConnectionStatus;

	constructor(initial: ConnectionStatus = "disconnected") {
		this._state = initial;
	}

	get state(): ConnectionStatus {
		return this._state;
	}

	transition(to: ConnectionStatus): boolean {
		if (this._state === to) return true;

		const allowed = VALID_TRANSITIONS[this._state];
		if (!allowed.includes(to)) {
			console.warn(
				`[NeroMpcSDK] Invalid state transition: ${this._state} -> ${to}`,
			);
			return false;
		}

		this._state = to;
		return true;
	}

	reset(): void {
		this._state = "disconnected";
	}
}
