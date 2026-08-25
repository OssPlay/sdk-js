import { apiFetchRaw, type ApiContext, enc, projectUrl } from "./internal";
import type { ImageTransformOptions } from "./types";

// Built by AssetRef.transform() — nothing is fetched until .url() or .blob()
// is actually called.
export class ImageTransformRef {
	constructor(
		private readonly ctx: ApiContext,
		private readonly assetId: string,
		private readonly options: ImageTransformOptions,
	) {}

	private query(): string {
		const params = new URLSearchParams();
		if (this.options.w) params.set("w", String(this.options.w));
		if (this.options.h) params.set("h", String(this.options.h));
		if (this.options.format) params.set("format", this.options.format);
		if (this.options.q) params.set("q", String(this.options.q));
		return params.toString();
	}

	/** A direct URL for `<img src>`. Appends `?access_key=` if a key is set — the only auth form that works in a bare URL. */
	url(): string {
		const params = new URLSearchParams(this.query());
		if (this.ctx.apiKey) params.set("access_key", this.ctx.apiKey);
		const path = `${projectUrl(this.ctx)}/${enc(this.assetId)}`;
		const query = params.toString();
		return query ? `${path}?${query}` : path;
	}

	/** Fetches the transformed image bytes directly, using header auth. */
	async blob(): Promise<Blob> {
		const query = this.query();
		const response = await apiFetchRaw(this.ctx, `/${enc(this.assetId)}${query ? `?${query}` : ""}`);
		return response.blob();
	}
}
