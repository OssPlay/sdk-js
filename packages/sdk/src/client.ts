import { createFilesApi, type FilesApi } from "./files";
import { ImageRequest } from "./image";
import type { ImageTransformOptions, OSSPlayOptions } from "./types";
import { VideoEmbed } from "./video";

// Talks to a self-hosted OSSPlay instance's public consumer API, mounted at
// /v1 on the API and reachable externally at /api/v1 (see
// infra/caddy/Caddyfile's strip-prefix rule in the ossplay repo) — separate
// from the dashboard's own session-cookie-authed API.
export class OSSPlay {
	private readonly baseUrl: string;
	private readonly project: string;
	private readonly apiKey: string | undefined;

	readonly files: FilesApi;

	constructor(options: OSSPlayOptions) {
		this.baseUrl = `${options.endpoint.replace(/\/$/, "")}/api/v1`;
		this.project = options.project;
		this.apiKey = options.apiKey;
		this.files = createFilesApi(this.baseUrl, this.project, this.apiKey);
	}

	/** Builds a reference to an image, for a direct URL or transformed bytes. */
	image(assetId: string, options: ImageTransformOptions = {}): ImageRequest {
		return new ImageRequest(this.baseUrl, this.project, assetId, this.apiKey, options);
	}

	/** Builds a reference to a video, for an embeddable iframe player URL. */
	video(assetId: string): VideoEmbed {
		return new VideoEmbed(this.baseUrl, this.project, assetId, this.apiKey);
	}
}
