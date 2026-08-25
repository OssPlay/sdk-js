import type { OSSPlayError } from "./http";

/** One failed entry from FolderRef.upload()'s per-file result array — the counterpart to AssetRef on success. */
export class ErrorRef {
	constructor(
		readonly filename: string,
		readonly error: OSSPlayError,
	) {}
}
