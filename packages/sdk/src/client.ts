import { FolderRef } from "./folder-ref";
import type { OSSPlayOptions } from "./types";

// The project root is just a FolderRef with no target — every method
// (.list(), .upload(), .asset(id), .folder(id), .create(name)) works
// identically here and on any folder you get from it. See folder-ref.ts's
// class comment for why chaining is ergonomic convenience, not nesting.
export class OSSPlay extends FolderRef {
	constructor(options: OSSPlayOptions) {
		super(
			{
				baseUrl: `${options.endpoint.replace(/\/$/, "")}/api/v1`,
				project: options.project,
				apiKey: options.apiKey,
			},
			null,
		);
	}
}
