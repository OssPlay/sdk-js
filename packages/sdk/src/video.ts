import { authHeaders, throwForStatus } from "./http";

export interface VideoEmbedOptions {
	/** How long a private project's embed link stays valid. Ignored for a public project — its embed URL never expires. @default "30d" */
	expiresIn?: "1h" | "1d" | "7d" | "30d";
}

// Built lazily by OSSPlay.video() — nothing is fetched until embedUrl()/
// embedIframe() is actually called.
export class VideoEmbed {
	constructor(
		private readonly baseUrl: string,
		private readonly project: string,
		private readonly assetId: string,
		private readonly apiKey: string | undefined,
	) {}

	/**
	 * The embeddable player URL (apps/dashboard's /embed page) for this video —
	 * calls POST /v1/:project/:assetId/embed-token. A public project's video
	 * returns immediately with no token needed; a private one requires an
	 * API key and mints a short-lived, single-asset share link server-side
	 * (the same grant the dashboard's own "Embed" dialog uses), so the raw
	 * API key is never exposed in a URL meant to sit in a public page's
	 * `<iframe src>`.
	 */
	async embedUrl(options: VideoEmbedOptions = {}): Promise<string> {
		const response = await fetch(
			`${this.baseUrl}/${encodeURIComponent(this.project)}/${encodeURIComponent(this.assetId)}/embed-token`,
			{
				method: "POST",
				headers: { ...authHeaders(this.apiKey), "Content-Type": "application/json" },
				body: JSON.stringify(options.expiresIn ? { duration: options.expiresIn } : {}),
			},
		);
		if (!response.ok) return throwForStatus(response);
		const result = (await response.json()) as { url: string };
		return result.url;
	}

	/** A ready `<iframe>` HTML snippet embedding this video. */
	async embedIframe(
		options: VideoEmbedOptions & { width?: number; height?: number } = {},
	): Promise<string> {
		const url = await this.embedUrl(options);
		const width = options.width ?? 640;
		const height = options.height ?? 360;
		return `<iframe src="${url}" width="${width}" height="${height}" frameborder="0" allowfullscreen></iframe>`;
	}
}
