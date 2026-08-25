import { authHeaders, throwForStatus } from "./http";

export interface ApiContext {
	baseUrl: string;
	project: string;
	apiKey: string | undefined;
}

export const JSON_HEADERS = { "Content-Type": "application/json" };

export function projectUrl(ctx: ApiContext): string {
	return `${ctx.baseUrl}/${encodeURIComponent(ctx.project)}`;
}

export function enc(id: string): string {
	return encodeURIComponent(id);
}

/** GET/POST/PATCH/DELETE against a path under this project's base URL, parsed as JSON. `204`/no body responses resolve to `undefined`. */
export async function apiFetch<T>(ctx: ApiContext, path: string, init: RequestInit = {}): Promise<T> {
	const response = await fetch(`${projectUrl(ctx)}${path}`, {
		...init,
		headers: { ...authHeaders(ctx.apiKey), ...init.headers },
	});
	if (!response.ok) return throwForStatus(response);
	if (response.status === 204) return undefined as T;
	return response.json() as Promise<T>;
}

/** Same as apiFetch, but hands back the raw Response (for bytes/blob reads) instead of parsing JSON. */
export async function apiFetchRaw(ctx: ApiContext, path: string, init: RequestInit = {}): Promise<Response> {
	const response = await fetch(`${projectUrl(ctx)}${path}`, {
		...init,
		headers: { ...authHeaders(ctx.apiKey), ...init.headers },
	});
	if (!response.ok) return throwForStatus(response);
	return response;
}

/** True when `url` resolves to the same origin as this context's own instance — i.e. a proxied route, not a real external storage URL. */
export function isSameOrigin(ctx: ApiContext, url: string): boolean {
	return new URL(url, ctx.baseUrl).origin === new URL(ctx.baseUrl).origin;
}
