import { apiFetch, apiFetchRaw, type ApiContext, enc, isSameOrigin, JSON_HEADERS } from "./internal";
import { ImageTransformRef } from "./image-transform-ref";
import type { AssetInfo, AssetSummary, DirectUrl, ImageTransformOptions, RenditionSpec } from "./types";

export interface EmbedOptions {
	width?: number;
	height?: number;
	expiresIn?: "1h" | "1d" | "7d" | "30d";
}

export interface EmbedResult {
	url: string;
	iframe: string;
}

export interface UrlOptions {
	disposition?: "inline" | "attachment";
	/** Throw instead of falling back to a same-instance proxied URL — use when you specifically need a real external storage URL (e.g. handing it to a CDN) and would rather fail loudly than silently get one that still round-trips through this API. */
	direct?: boolean;
}

// One asset (original or variant), addressed by id. Nothing fetches until
// you call a method — building a ref is free.
export class AssetRef {
	/**
	 * Set only when this ref came from a call that already had the data
	 * (list(), upload(), requestRendition()) — undefined when built directly
	 * via .asset(id), since nothing is fetched just to construct a ref. Use
	 * `.info` for an always-fresh, authoritative fetch either way.
	 */
	readonly summary?: AssetSummary;

	constructor(
		private readonly ctx: ApiContext,
		readonly id: string,
		summary?: AssetSummary,
	) {
		this.summary = summary;
	}

	/** Metadata only, no bytes. */
	get info(): Promise<AssetInfo> {
		return apiFetch<{ asset: AssetInfo }>(this.ctx, `/${enc(this.id)}/info`).then((r) => r.asset);
	}

	/** Original bytes, any file type. */
	async download(): Promise<Uint8Array> {
		const response = await apiFetchRaw(this.ctx, `/${enc(this.id)}`);
		return new Uint8Array(await response.arrayBuffer());
	}

	/** Same bytes as download(), as a Blob — for browser use (`URL.createObjectURL`, etc). */
	async blob(): Promise<Blob> {
		const response = await apiFetchRaw(this.ctx, `/${enc(this.id)}`);
		return response.blob();
	}

	/** Step 2 of a browser-driven upload (see `FolderRef.createUploadUrl()`) — call once the browser's PUT finishes, to verify the bytes actually landed and kick off any processing (thumbnails, transcodes). Throws `invalid_input` if nothing was ever PUT to this asset's upload target. */
	async confirmUpload(): Promise<AssetInfo> {
		const result = await apiFetch<{ asset: AssetInfo }>(this.ctx, `/${enc(this.id)}/confirm`, {
			method: "POST",
		});
		return result.asset;
	}

	async rename(filename: string): Promise<AssetInfo> {
		const result = await apiFetch<{ asset: AssetInfo }>(this.ctx, `/${enc(this.id)}`, {
			method: "PATCH",
			headers: JSON_HEADERS,
			body: JSON.stringify({ filename }),
		});
		return result.asset;
	}

	/** An id, a "/a/b/c" path (auto-creating), or `null` to move to the project root. */
	async move(folder: string | null): Promise<AssetInfo> {
		const result = await apiFetch<{ asset: AssetInfo }>(this.ctx, `/${enc(this.id)}`, {
			method: "PATCH",
			headers: JSON_HEADERS,
			body: JSON.stringify({ folder }),
		});
		return result.asset;
	}

	/** Throws if this asset isn't an image (checked via .info first). */
	async transform(options: ImageTransformOptions = {}): Promise<ImageTransformRef> {
		const info = await this.info;
		if (!info.mimeType.startsWith("image/")) {
			throw new Error(`transform() only applies to images — this asset is ${info.mimeType}`);
		}
		return new ImageTransformRef(this.ctx, this.id, options);
	}

	/** Throws if this asset isn't video/audio (checked via .info first). Returns a ref to the new (or already-cached) variant — `.info` reports its `status`. */
	async requestRendition(spec: RenditionSpec): Promise<AssetRef> {
		const info = await this.info;
		if (!info.mimeType.startsWith("video/") && !info.mimeType.startsWith("audio/")) {
			throw new Error(`requestRendition() only applies to video/audio — this asset is ${info.mimeType}`);
		}
		const result = await apiFetch<{ asset: { id: string } }>(this.ctx, `/${enc(this.id)}/variants`, {
			method: "POST",
			headers: JSON_HEADERS,
			body: JSON.stringify({ spec }),
		});
		return new AssetRef(this.ctx, result.asset.id);
	}

	/** Every rendition and subtitle requested for this asset, each as its own ref. */
	async variants(): Promise<AssetRef[]> {
		const result = await apiFetch<{ variants: { id: string }[] }>(this.ctx, `/${enc(this.id)}/variants`);
		return result.variants.map((v) => new AssetRef(this.ctx, v.id));
	}

	/** A direct storage URL. Only for a `ready` asset/variant — throws (`not_ready`) otherwise. */
	async url(options: UrlOptions = {}): Promise<DirectUrl> {
		const query = new URLSearchParams();
		if (options.disposition) query.set("disposition", options.disposition);
		const q = query.toString();
		const result = await apiFetch<DirectUrl>(this.ctx, `/${enc(this.id)}/url${q ? `?${q}` : ""}`);
		if (options.direct && isSameOrigin(this.ctx, result.url)) {
			throw new Error(
				"No direct storage URL is available for this asset — this project has no S3 destination configured, so every URL proxies through this instance.",
			);
		}
		return result;
	}

	/** Throws if this asset isn't video (checked via .info first). Public projects need no key; private ones mint a short-lived, single-video grant server-side. */
	async embed(options: EmbedOptions = {}): Promise<EmbedResult> {
		const info = await this.info;
		if (!info.mimeType.startsWith("video/")) {
			throw new Error(`embed() only applies to video — this asset is ${info.mimeType}`);
		}
		const result = await apiFetch<{ url: string }>(this.ctx, `/${enc(this.id)}/embed-token`, {
			method: "POST",
			headers: JSON_HEADERS,
			body: JSON.stringify(options.expiresIn ? { duration: options.expiresIn } : {}),
		});
		const width = options.width ?? 640;
		const height = options.height ?? 360;
		return {
			url: result.url,
			iframe: `<iframe src="${result.url}" width="${width}" height="${height}" frameborder="0" allowfullscreen></iframe>`,
		};
	}

	/** Permanent — no trash/undo at this layer. */
	async delete(): Promise<void> {
		await apiFetch<void>(this.ctx, `/${enc(this.id)}`, { method: "DELETE" });
	}
}
