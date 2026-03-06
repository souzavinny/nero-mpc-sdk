export type RequestContext = {
	method: string;
	path: string;
	url: string;
	body?: unknown;
	headers: Record<string, string>;
	credentials: RequestCredentials;
};

export type RequestMiddleware = (
	context: RequestContext,
	next: (context: RequestContext) => Promise<Response>,
) => Promise<Response>;

export function createPipeline(
	middlewares: RequestMiddleware[],
	baseFetch: (context: RequestContext) => Promise<Response>,
): (context: RequestContext) => Promise<Response> {
	return middlewares.reduceRight<(ctx: RequestContext) => Promise<Response>>(
		(next, middleware) => (ctx) => middleware(ctx, next),
		baseFetch,
	);
}
