export class OSSPlayError extends Error {
	constructor(
		message: string,
		public readonly status: number,
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
