export interface OSSPlayOptions {
	/** Base URL of the OSSPlay instance, e.g. "https://media.example.com". */
	endpoint: string;
	/** Project-scoped API key. Omit for read-only access to a public project. */
	apiKey?: string;
	/** Project id (the project's slug, not a UUID). */
	project: string;
}

export type ImageFormat = "webp" | "avif" | "jpeg" | "png" | "original";

export interface ImageTransformOptions {
	w?: number;
	h?: number;
	format?: ImageFormat;
	q?: number;
}

export interface AssetSummary {
	id: string;
	filename: string;
	mimeType: string;
	size: number;
	status: "pending" | "processing" | "ready" | "failed";
	createdAt: string;
}

export interface FolderSummary {
	id: string;
	name: string;
}

export interface UploadedAsset {
	assetId: string;
	filename: string;
	mimeType: string;
	size: number;
}

/** A File/Blob-like upload input, with an optional filename override. */
export type UploadInput = File | { data: Blob | Uint8Array; filename: string; mimeType?: string };

export interface FolderInfo {
	id: string;
	name: string;
	parentId: string | null;
	createdAt: string;
}

export interface AssetInfo {
	id: string;
	filename: string;
	mimeType: string;
	size: number | null;
	status: "pending" | "processing" | "ready" | "failed";
	folderId: string | null;
	parentAssetId: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface DirectUrl {
	url: string;
	/** Seconds until the URL expires — omitted for a static/CDN URL, which doesn't. */
	expiresIn?: number;
}

/** What AssetRef.requestRendition() can ask for — matches the server's real variant kinds, minus `image-format` (superseded by AssetRef.transform()) and `scrub-thumbnails` (fires automatically on video upload, never caller-requested). */
export type RenditionSpec =
	| { kind: "video-transcode"; height: 480 | 720 | 1080; format: "mp4" | "webm" }
	| { kind: "audio-transcode"; bitrate: "96k" | "128k" | "192k" | "320k" }
	| { kind: "hls-package" };
