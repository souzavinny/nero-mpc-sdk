import type { RequestMiddleware } from "../request-pipeline";

export interface RetryConfig {
	maxRetries?: number;
	retryableStatuses?: number[];
	baseDelayMs?: number;
	maxDelayMs?: number;
	retryableMethods?: string[];
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
	maxRetries: 3,
	retryableStatuses: [429, 500, 502, 503, 504],
	baseDelayMs: 500,
	maxDelayMs: 10000,
	retryableMethods: ["GET", "HEAD", "OPTIONS", "PUT", "DELETE"],
};

function computeDelay(
	attempt: number,
	baseDelayMs: number,
	maxDelayMs: number,
	retryAfterMs?: number,
): number {
	if (retryAfterMs !== undefined) {
		return Math.min(retryAfterMs, maxDelayMs);
	}
	const exponential = baseDelayMs * 2 ** attempt;
	const jitter = Math.random() * baseDelayMs;
	return Math.min(exponential + jitter, maxDelayMs);
}

function parseRetryAfter(response: Response): number | undefined {
	const header = response.headers.get("Retry-After");
	if (!header) return undefined;

	const seconds = Number(header);
	if (!Number.isNaN(seconds)) {
		return seconds * 1000;
	}

	const date = Date.parse(header);
	if (!Number.isNaN(date)) {
		return Math.max(0, date - Date.now());
	}

	return undefined;
}

export function createRetryMiddleware(config?: RetryConfig): RequestMiddleware {
	const resolved = { ...DEFAULT_RETRY_CONFIG, ...config };

	return async (context, next) => {
		const isRetryable = resolved.retryableMethods.includes(
			context.method.toUpperCase(),
		);

		let lastError: unknown;
		let lastResponse: Response | undefined;

		for (let attempt = 0; attempt <= resolved.maxRetries; attempt++) {
			try {
				const response = await next(context);

				if (
					!isRetryable ||
					attempt === resolved.maxRetries ||
					!resolved.retryableStatuses.includes(response.status)
				) {
					return response;
				}

				lastResponse = response;
				const retryAfterMs = parseRetryAfter(response);
				const delay = computeDelay(
					attempt,
					resolved.baseDelayMs,
					resolved.maxDelayMs,
					retryAfterMs,
				);
				await sleep(delay);
			} catch (error) {
				if (!isRetryable || attempt === resolved.maxRetries) {
					throw error;
				}
				lastError = error;
				const delay = computeDelay(
					attempt,
					resolved.baseDelayMs,
					resolved.maxDelayMs,
				);
				await sleep(delay);
			}
		}

		if (lastResponse) return lastResponse;
		throw lastError;
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
