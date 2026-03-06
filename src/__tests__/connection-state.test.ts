import { describe, expect, it, vi } from "vitest";
import { ConnectionStateMachine } from "../core/connection-state";

describe("ConnectionStateMachine", () => {
	it("should start in disconnected state", () => {
		const sm = new ConnectionStateMachine();
		expect(sm.state).toBe("disconnected");
	});

	it("should allow valid transition: disconnected → connecting", () => {
		const sm = new ConnectionStateMachine();
		sm.transition("connecting");
		expect(sm.state).toBe("connecting");
	});

	it("should allow valid transition: connecting → connected", () => {
		const sm = new ConnectionStateMachine();
		sm.transition("connecting");
		sm.transition("connected");
		expect(sm.state).toBe("connected");
	});

	it("should allow valid transition: connecting → errored", () => {
		const sm = new ConnectionStateMachine();
		sm.transition("connecting");
		sm.transition("errored");
		expect(sm.state).toBe("errored");
	});

	it("should allow valid transition: connected → disconnected", () => {
		const sm = new ConnectionStateMachine();
		sm.transition("connecting");
		sm.transition("connected");
		sm.transition("disconnected");
		expect(sm.state).toBe("disconnected");
	});

	it("should allow valid transition: errored → connecting (retry)", () => {
		const sm = new ConnectionStateMachine();
		sm.transition("connecting");
		sm.transition("errored");
		sm.transition("connecting");
		expect(sm.state).toBe("connecting");
	});

	it("should warn on invalid transition and remain in current state", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const sm = new ConnectionStateMachine();

		sm.transition("connected"); // invalid: disconnected → connected

		expect(sm.state).toBe("disconnected");
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("disconnected -> connected"),
		);
		warnSpy.mockRestore();
	});

	it("should allow valid transition: connected → errored", () => {
		const sm = new ConnectionStateMachine();
		sm.transition("connecting");
		sm.transition("connected");
		sm.transition("errored");
		expect(sm.state).toBe("errored");
	});

	it("should reset to disconnected", () => {
		const sm = new ConnectionStateMachine();
		sm.transition("connecting");
		sm.transition("connected");

		sm.reset();

		expect(sm.state).toBe("disconnected");
	});

	it("should allow full reconnection cycle", () => {
		const sm = new ConnectionStateMachine();

		sm.transition("connecting");
		sm.transition("connected");
		sm.transition("disconnected");
		sm.transition("connecting");
		sm.transition("errored");
		sm.transition("connecting");
		sm.transition("connected");

		expect(sm.state).toBe("connected");
	});

	it("should treat self-transition as no-op returning true", () => {
		const sm = new ConnectionStateMachine();
		const result = sm.transition("disconnected");

		expect(result).toBe(true);
		expect(sm.state).toBe("disconnected");
	});
});
