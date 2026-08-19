import { authHeaders, throwForStatus } from "./http";
import type { AssetSummary, ListResult, UploadedAsset, UploadInput } from "./types";

function toFile(input: UploadInput): File {
	if (input instanceof File) return input;
	return new File([input.data as BlobPart], input.filename, { type: input.mimeType });
}

export interface FilesApi {
	list(options?: { folder?: string }): Promise<ListResult>;
	upload(...files: UploadInput[]): Promise<UploadedAsset[]>;
	/** Downloads an asset's original bytes, regardless of file type. */
	download(assetId: string): Promise<Blob>;
	delete(assetId: string): Promise<void>;
}

export function createFilesApi(
	baseUrl: string,
	project: string,
	apiKey: string | undefined,
): FilesApi {
	const projectUrl = `${baseUrl}/${encodeURIComponent(project)}`;

	return {
		async list(options) {
			const url = new URL(projectUrl);
			if (options?.folder) url.searchParams.set("folder", options.folder);
			const response = await fetch(url, { headers: authHeaders(apiKey) });
			if (!response.ok) return throwForStatus(response);
			return response.json() as Promise<{ folders: ListResult["folders"]; assets: AssetSummary[] }>;
		},

		async upload(...files) {
			if (!apiKey) throw new Error("An API key is required to upload files");
			const body = new FormData();
			for (const [index, input] of files.entries()) body.append(`file${index}`, toFile(input));
			const response = await fetch(`${projectUrl}/upload`, {
				method: "POST",
				headers: authHeaders(apiKey),
				body,
			});
			if (!response.ok) return throwForStatus(response);
			const result = (await response.json()) as { assets: UploadedAsset[] };
			return result.assets;
		},

		async download(assetId) {
			const response = await fetch(`${projectUrl}/${encodeURIComponent(assetId)}`, {
				headers: authHeaders(apiKey),
			});
			if (!response.ok) return throwForStatus(response);
			return response.blob();
		},

		async delete(assetId) {
			if (!apiKey) throw new Error("An API key is required to delete files");
			const response = await fetch(`${projectUrl}/${encodeURIComponent(assetId)}`, {
				method: "DELETE",
				headers: authHeaders(apiKey),
			});
			if (!response.ok && response.status !== 204) return throwForStatus(response);
		},
	};
}
