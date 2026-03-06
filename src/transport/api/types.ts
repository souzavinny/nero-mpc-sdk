export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RequestFn = <T>(
	method: HttpMethod,
	path: string,
	body?: unknown,
	requiresAuth?: boolean,
) => Promise<T>;
