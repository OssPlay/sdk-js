import { AssetRef } from "./asset-ref";
import { ErrorRef } from "./error-ref";
import { OSSPlayError } from "./http";
import { apiFetch, type ApiContext, JSON_HEADERS } from "./internal";
import type { AssetSummary, FolderInfo, FolderSummary, UploadedAsset, UploadInput } from "./types";

export interface ListOptions {
	/** Return only assets, as a flat array, skipping folders entirely. */
	assets?: boolean;
	/** Return only folders, as a flat array, skipping assets entirely. */
	folders?: boolean;
}

export interface FolderOptions {
	/** Auto-create if missing: a "/a/b" path creates every missing segment; a bare name creates it at the project root. Without this, a missing target throws `not_found` the first time it's actually used. */
	create?: boolean;
}

function toFile(input: UploadInput): File {
	if (input instanceof File) return input;
	return new File([input.data as BlobPart], input.filename, { type: input.mimeType });
}

// One folder (or the project root, when `target` is null), addressed by id
// or by a "/a/b/c" path — resolution is always absolute, never relative to
// wherever this ref came from; chaining off a non-root ref is ergonomic
// convenience, not nesting (use .create(name) for an actual child of this
// ref). Nothing fetches until you call a method.
export class FolderRef {
	/** Set only when this ref came from a call that already had the data (list(), create()) — undefined when built directly via .folder(id). Use `.info` for an always-fresh fetch either way. */
	readonly summary?: FolderSummary;

	constructor(
		protected readonly ctx: ApiContext,
		private readonly target: string | null,
		private readonly autoCreate: boolean = false,
		summary?: FolderSummary,
	) {
		this.summary = summary;
	}

	// Read routes (list, folder info) never auto-create — only the create
	// endpoint and upload's ?folder= do, server-side. So a { create: true }
	// ref backs its reads with one idempotent ensure-it-exists call first,
	// memoized so a burst of calls on the same ref only pays for it once.
	private ensured: Promise<void> | null = null;
	private ensureExists(): Promise<void> {
		if (this.target === null || !this.autoCreate) return Promise.resolve();
		if (!this.ensured) {
			const path = this.target.startsWith("/") ? this.target : `/${this.target}`;
			this.ensured = apiFetch<unknown>(this.ctx, "/folders", {
				method: "POST",
				headers: JSON_HEADERS,
				body: JSON.stringify({ path }),
			}).then(() => undefined);
		}
		return this.ensured;
	}

	// A bare (non-path) name only means "root-level name" once { create:
	// true } opts into treating it as one instead of a literal id — see the
	// class comment for why a bare string defaults to "id".
	private queryFolderParam(): string | null {
		if (this.target === null) return null;
		if (this.target.startsWith("/")) return this.target;
		return this.autoCreate ? `/${this.target}` : this.target;
	}

	private resolvedId: Promise<string> | null = null;
	// Only rename/move/delete need a real id — PATCH/DELETE .../folders/:id
	// take one in the URL; every read/list/upload route already accepts
	// id-or-path itself.
	private resolveId(): Promise<string> {
		if (this.target === null) {
			throw new Error("The root folder has no id — rename/move/delete don't apply to it.");
		}
		if (!this.resolvedId) {
			this.resolvedId = this.ensureExists().then(async () => {
				const t = this.queryFolderParam() as string;
				if (!t.startsWith("/")) return t;
				const result = await apiFetch<{ folder: { id: string } }>(
					this.ctx,
					`/folders?path=${encodeURIComponent(t)}`,
				);
				return result.folder.id;
			});
		}
		return this.resolvedId;
	}

	get info(): Promise<{ folder: FolderInfo | null; breadcrumb: FolderInfo[] }> {
		if (this.target === null) return Promise.resolve({ folder: null, breadcrumb: [] });
		return this.ensureExists().then(() => {
			const t = this.queryFolderParam() as string;
			const path = t.startsWith("/")
				? `/folders?path=${encodeURIComponent(t)}`
				: `/folders/${encodeURIComponent(t)}`;
			return apiFetch<{ folder: FolderInfo; breadcrumb: FolderInfo[] }>(this.ctx, path);
		});
	}

	list(options: { assets: true; folders?: never }): Promise<AssetRef[]>;
	list(options: { folders: true; assets?: never }): Promise<FolderRef[]>;
	list(options?: ListOptions): Promise<{ folders: FolderRef[]; assets: AssetRef[] }>;
	async list(
		options: ListOptions = {},
	): Promise<{ folders: FolderRef[]; assets: AssetRef[] } | AssetRef[] | FolderRef[]> {
		await this.ensureExists();
		const target = this.queryFolderParam();
		const query = target ? `?folder=${encodeURIComponent(target)}` : "";
		const raw = await apiFetch<{ folders: FolderSummary[]; assets: AssetSummary[] }>(this.ctx, query);

		if (options.assets) return raw.assets.map((a) => new AssetRef(this.ctx, a.id, a));
		if (options.folders) return raw.folders.map((f) => new FolderRef(this.ctx, f.id, false, f));
		return {
			folders: raw.folders.map((f) => new FolderRef(this.ctx, f.id, false, f)),
			assets: raw.assets.map((a) => new AssetRef(this.ctx, a.id, a)),
		};
	}

	/** Creates a new child of *this* folder, by name — conflicts (throws `conflict`) if a sibling already has that name. For an idempotent "ensure this exists" instead, use `.folder(path, { create: true })`. */
	async create(name: string): Promise<FolderRef> {
		const parentId = this.target === null ? null : await this.resolveId();
		const result = await apiFetch<{ folder: FolderSummary }>(this.ctx, "/folders", {
			method: "POST",
			headers: JSON_HEADERS,
			body: JSON.stringify({ name, parentId }),
		});
		return new FolderRef(this.ctx, result.folder.id, false, result.folder);
	}

	/** A ref to an absolute folder id or "/a/b/c" path — not relative to this ref. Pass `{ create: true }` to auto-create a missing path (or a bare name, created at the project root). */
	folder(target: string, options: FolderOptions = {}): FolderRef {
		return new FolderRef(this.ctx, target, options.create ?? false);
	}

	/** A ref to an asset by id — nothing fetches until you call a method on it. */
	asset(id: string): AssetRef {
		return new AssetRef(this.ctx, id);
	}

	/**
	 * Uploads each file as its own request, so one bad file doesn't fail the
	 * rest — the result array is one entry per input file, in order:
	 * `AssetRef` on success, `ErrorRef` on failure. Always requires an API
	 * key, even on a public project.
	 */
	async upload(...files: UploadInput[]): Promise<(AssetRef | ErrorRef)[]> {
		if (!this.ctx.apiKey) throw new Error("An API key is required to upload files");
		const target = this.queryFolderParam();
		const query = target ? `?folder=${encodeURIComponent(target)}` : "";

		return Promise.all(
			files.map(async (input) => {
				const file = toFile(input);
				try {
					const body = new FormData();
					body.append("file", file);
					const result = await apiFetch<{ assets: UploadedAsset[] }>(this.ctx, `/upload${query}`, {
						method: "POST",
						body,
					});
					const uploaded = result.assets[0];
					if (!uploaded) throw new Error("Upload succeeded but returned no asset");
					return new AssetRef(this.ctx, uploaded.assetId);
				} catch (err) {
					if (err instanceof OSSPlayError) return new ErrorRef(file.name, err);
					throw err;
				}
			}),
		);
	}

	async rename(name: string): Promise<FolderInfo> {
		const id = await this.resolveId();
		const result = await apiFetch<{ folder: FolderInfo }>(this.ctx, `/folders/${id}`, {
			method: "PATCH",
			headers: JSON_HEADERS,
			body: JSON.stringify({ name }),
		});
		return result.folder;
	}

	/** An id, a "/a/b/c" path (auto-creating), or `null` to move to the project root. */
	async move(parent: string | null): Promise<FolderInfo> {
		const id = await this.resolveId();
		const result = await apiFetch<{ folder: FolderInfo }>(this.ctx, `/folders/${id}`, {
			method: "PATCH",
			headers: JSON_HEADERS,
			body: JSON.stringify({ parentId: parent }),
		});
		return result.folder;
	}

	/** Permanent, and removes everything inside it. */
	async delete(): Promise<void> {
		const id = await this.resolveId();
		await apiFetch<void>(this.ctx, `/folders/${id}`, { method: "DELETE" });
	}
}
