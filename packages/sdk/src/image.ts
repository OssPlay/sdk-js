import { throwForStatus } from "./http";
import type { ImageTransformOptions } from "./types";

// Built lazily by OSSPlay.image() — its .url() is meant to go straight into
// an <img src>, so it never fetches anything until asked to.
export class ImageRequest {
	constructor(
		private readonly baseUrl: string,
		private readonly project: string,
		private readonly assetId: string,
		private readonly apiKey: string | undefined,
		private readonly opts: ImageTransformOptions,
	) {}

	/**
	 * A direct, embeddable URL for this image (e.g. for `<img src>`). If an
	 * API key is set, it's appended as `?access_key=` — the only auth form
	 * that works in a URL with no request-building of your own. Omit the key
	 * entirely for a public project.
	 */
	url(): string {
		const params = new URLSearchParams();
		if (this.opts.w) params.set("w", String(this.opts.w));
		if (this.opts.h) params.set("h", String(this.opts.h));
		if (this.opts.format) params.set("format", this.opts.format);
		if (this.opts.q) params.set("q", String(this.opts.q));
		if (this.apiKey) params.set("access_key", this.apiKey);
		const query = params.toString();
		const path = `${this.baseUrl}/${encodeURIComponent(this.project)}/${encodeURIComponent(this.assetId)}`;
		return query ? `${path}?${query}` : path;
	}

	/** Fetches the transformed image bytes directly, using the header auth form. */
	async blob(): Promise<Blob> {
		const params = new URLSearchParams();
		if (this.opts.w) params.set("w", String(this.opts.w));
		if (this.opts.h) params.set("h", String(this.opts.h));
		if (this.opts.format) params.set("format", this.opts.format);
		if (this.opts.q) params.set("q", String(this.opts.q));
		const query = params.toString();
		const path = `${this.baseUrl}/${encodeURIComponent(this.project)}/${encodeURIComponent(this.assetId)}`;
		const response = await fetch(query ? `${path}?${query}` : path, {
			headers: this.apiKey ? { "X-Api-Key": this.apiKey } : {},
		});
		if (!response.ok) return throwForStatus(response);
		return response.blob();
	}
}
