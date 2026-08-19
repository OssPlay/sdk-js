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

export interface ListResult {
	folders: FolderSummary[];
	assets: AssetSummary[];
}

export interface UploadedAsset {
	assetId: string;
	filename: string;
	mimeType: string;
	size: number;
}

/** A File/Blob-like upload input, with an optional filename override. */
export type UploadInput = File | { data: Blob | Uint8Array; filename: string; mimeType?: string };
