// Stable, checkable in code without hardcoding an HTTP status number —
// derived client-side from `status` (see statusToCode below); /v1 itself has
// no structured error-code field, just a fixed, documented set of status
// codes per route (see docs/content/docs/consumer/reference/endpoints.mdx),
// so this mapping is exhaustive and won't silently drift.
export type OSSPlayErrorCode =
	| "not_found"
	| "unauthorized"
	| "conflict"
	| "invalid_input"
	| "not_ready"
	| "rate_limited"
	| "unknown";

function statusToCode(status: number): OSSPlayErrorCode {
	switch (status) {
		case 404:
			return "not_found";
		case 401:
			return "unauthorized";
		case 409:
			return "conflict";
		case 400:
			return "invalid_input";
		case 425:
			return "not_ready";
		case 503:
			return "rate_limited";
		default:
			return "unknown";
	}
}

export class OSSPlayError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly code: OSSPlayErrorCode = statusToCode(status),
	) {
		super(message);
		this.name = "OSSPlayError";
	}
}

// Every non-2xx response from /v1 is JSON `{ error: string }` (see
// apps/api/src/routes/v1.ts) except for a plain-body 404 on a missing local-
// disk object — fall back to the status text when the body isn't JSON.
export async function throwForStatus(response: Response): Promise<never> {
	const message = await response
		.clone()
		.json()
		.then((body: unknown) => (body as { error?: string }).error)
		.catch(() => null);
	throw new OSSPlayError(message ?? response.statusText, response.status);
}

export function authHeaders(apiKey: string | undefined): HeadersInit {
	return apiKey ? { "X-Api-Key": apiKey } : {};
}
