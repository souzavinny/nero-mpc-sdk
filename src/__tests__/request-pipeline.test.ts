import { describe, expect, it, vi } from "vitest";
import { createRetryMiddleware } from "../transport/middleware/retry";
import {
	type RequestContext,
	type RequestMiddleware,
	createPipeline,
} from "../transport/request-pipeline";

function makeContext(overrides?: Partial<RequestContext>): RequestContext {
	return {
		method: "GET",
		path: "/v2/test",
		url: "https://api.test.com/v2/test",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		...overrides,
	};
}

function okResponse(body = {}): Response {
	return new Response(JSON.stringify(body), { status: 200 });
}

describe("Request Pipeline", () => {
	it("should call base fetch when no middleware", async () => {
		const baseFetch = vi.fn().mockResolvedValue(okResponse());
		const pipeline = createPipeline([], baseFetch);
		const ctx = makeContext();

		await pipeline(ctx);

		expect(baseFetch).toHaveBeenCalledWith(ctx);
	});

	it("should compose middleware in order", async () => {
		const order: string[] = [];
		const m1: RequestMiddleware = async (ctx, next) => {
			order.push("m1-before");
			const res = await next(ctx);
			order.push("m1-after");
			return res;
		};
		const m2: RequestMiddleware = async (ctx, next) => {
			order.push("m2-before");
			const res = await next(ctx);
			order.push("m2-after");
			return res;
		};

		const baseFetch = vi.fn().mockImplementation(async () => {
			order.push("fetch");
			return okResponse();
		});

		const pipeline = createPipeline([m1, m2], baseFetch);
		await pipeline(makeContext());

		expect(order).toEqual([
			"m1-before",
			"m2-before",
			"fetch",
			"m2-after",
			"m1-after",
		]);
	});

	it("should allow middleware to modify context", async () => {
		const addHeader: RequestMiddleware = async (ctx, next) => {
			return next({
				...ctx,
				headers: { ...ctx.headers, "X-Custom": "value" },
			});
		};

		const baseFetch = vi.fn().mockResolvedValue(okResponse());
		const pipeline = createPipeline([addHeader], baseFetch);
		await pipeline(makeContext());

		expect(baseFetch).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: expect.objectContaining({ "X-Custom": "value" }),
			}),
		);
	});

	it("should propagate errors from base fetch", async () => {
		const baseFetch = vi.fn().mockRejectedValue(new Error("Network failure"));
		const pipeline = createPipeline([], baseFetch);

		await expect(pipeline(makeContext())).rejects.toThrow("Network failure");
	});

	it("should allow middleware to short-circuit", async () => {
		const cached = okResponse({ cached: true });
		const cacheMiddleware: RequestMiddleware = async () => cached;

		const baseFetch = vi.fn();
		const pipeline = createPipeline([cacheMiddleware], baseFetch);
		const result = await pipeline(makeContext());

		expect(result).toBe(cached);
		expect(baseFetch).not.toHaveBeenCalled();
	});
});

describe("Retry Middleware", () => {
	it("should not retry on 200 response", async () => {
		const baseFetch = vi.fn().mockResolvedValue(okResponse());
		const retry = createRetryMiddleware({ maxRetries: 3 });
		const pipeline = createPipeline([retry], baseFetch);

		await pipeline(makeContext());

		expect(baseFetch).toHaveBeenCalledTimes(1);
	});

	it("should retry on 500 error", async () => {
		const baseFetch = vi
			.fn()
			.mockResolvedValueOnce(new Response("error", { status: 500 }))
			.mockResolvedValueOnce(okResponse());

		const retry = createRetryMiddleware({
			maxRetries: 3,
			baseDelayMs: 1,
			maxDelayMs: 2,
		});
		const pipeline = createPipeline([retry], baseFetch);

		const result = await pipeline(makeContext());

		expect(baseFetch).toHaveBeenCalledTimes(2);
		expect(result.status).toBe(200);
	});

	it("should retry on 429 rate limit", async () => {
		const rateLimited = new Response("rate limited", {
			status: 429,
			headers: { "Retry-After": "1" },
		});
		const baseFetch = vi
			.fn()
			.mockResolvedValueOnce(rateLimited)
			.mockResolvedValueOnce(okResponse());

		const retry = createRetryMiddleware({
			maxRetries: 2,
			baseDelayMs: 1,
			maxDelayMs: 2,
		});
		const pipeline = createPipeline([retry], baseFetch);

		const result = await pipeline(makeContext());

		expect(baseFetch).toHaveBeenCalledTimes(2);
		expect(result.status).toBe(200);
	});

	it("should not retry on 400 client error", async () => {
		const baseFetch = vi
			.fn()
			.mockResolvedValue(new Response("bad request", { status: 400 }));

		const retry = createRetryMiddleware({
			maxRetries: 3,
			baseDelayMs: 1,
		});
		const pipeline = createPipeline([retry], baseFetch);

		const result = await pipeline(makeContext());

		expect(baseFetch).toHaveBeenCalledTimes(1);
		expect(result.status).toBe(400);
	});

	it("should not retry POST requests by default", async () => {
		const baseFetch = vi
			.fn()
			.mockResolvedValue(new Response("error", { status: 500 }));

		const retry = createRetryMiddleware({
			maxRetries: 3,
			baseDelayMs: 1,
		});
		const pipeline = createPipeline([retry], baseFetch);

		const result = await pipeline(makeContext({ method: "POST" }));

		expect(baseFetch).toHaveBeenCalledTimes(1);
		expect(result.status).toBe(500);
	});

	it("should retry network errors", async () => {
		const baseFetch = vi
			.fn()
			.mockRejectedValueOnce(new TypeError("Failed to fetch"))
			.mockResolvedValueOnce(okResponse());

		const retry = createRetryMiddleware({
			maxRetries: 2,
			baseDelayMs: 1,
			maxDelayMs: 2,
		});
		const pipeline = createPipeline([retry], baseFetch);

		const result = await pipeline(makeContext());

		expect(baseFetch).toHaveBeenCalledTimes(2);
		expect(result.status).toBe(200);
	});

	it("should throw after exhausting retries", async () => {
		const baseFetch = vi
			.fn()
			.mockRejectedValue(new TypeError("Failed to fetch"));

		const retry = createRetryMiddleware({
			maxRetries: 2,
			baseDelayMs: 1,
			maxDelayMs: 2,
		});
		const pipeline = createPipeline([retry], baseFetch);

		await expect(pipeline(makeContext())).rejects.toThrow("Failed to fetch");
		expect(baseFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
	});

	it("should return last failed response when retries exhausted on HTTP errors", async () => {
		const baseFetch = vi
			.fn()
			.mockResolvedValue(new Response("error", { status: 503 }));

		const retry = createRetryMiddleware({
			maxRetries: 1,
			baseDelayMs: 1,
		});
		const pipeline = createPipeline([retry], baseFetch);

		const result = await pipeline(makeContext());

		expect(baseFetch).toHaveBeenCalledTimes(2);
		expect(result.status).toBe(503);
	});
});
