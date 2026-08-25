import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { AssetRef } from "./asset-ref";
import { OSSPlay } from "./client";
import { ErrorRef } from "./error-ref";
import { FolderRef } from "./folder-ref";
import { OSSPlayError } from "./http";

describe("OSSPlay", () => {
	const originalFetch = globalThis.fetch;
	let calls: { url: string; init?: RequestInit }[];

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	const client = (apiKey?: string) =>
		new OSSPlay({ endpoint: "https://media.example.com", apiKey, project: "my-proj" });

	test("is itself a FolderRef scoped to the project root", () => {
		expect(client()).toBeInstanceOf(FolderRef);
	});

	test("root .info resolves to a null folder — root has no folder row", async () => {
		const { folder, breadcrumb } = await client().info;
		expect(folder).toBeNull();
		expect(breadcrumb).toEqual([]);
	});

	describe("list()", () => {
		beforeEach(() => {
			calls = [];
			globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
				calls.push({ url: input.toString(), init });
				return new Response(
					JSON.stringify({
						folders: [{ id: "folder_1", name: "photos" }],
						assets: [
							{
								id: "asset_1",
								filename: "a.txt",
								mimeType: "text/plain",
								size: 3,
								status: "ready",
								createdAt: "2026-01-01T00:00:00.000Z",
							},
						],
					}),
					{ status: 200 },
				);
			}) as unknown as typeof fetch;
		});

		test("returns { folders: FolderRef[], assets: AssetRef[] } at the root", async () => {
			const result = await client().list();
			expect(result.folders).toHaveLength(1);
			expect(result.folders[0]).toBeInstanceOf(FolderRef);
			expect(result.assets).toHaveLength(1);
			expect(result.assets[0]).toBeInstanceOf(AssetRef);
			expect(result.assets[0]?.id).toBe("asset_1");
			const url = new URL(calls[0]?.url ?? "");
			expect(url.pathname).toBe("/api/v1/my-proj");
			expect(url.search).toBe("");
		});

		test("{ assets: true } returns a flat AssetRef[]", async () => {
			const result = await client().list({ assets: true });
			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(1);
			expect(result[0]).toBeInstanceOf(AssetRef);
		});

		test("{ folders: true } returns a flat FolderRef[]", async () => {
			const result = await client().list({ folders: true });
			expect(Array.isArray(result)).toBe(true);
			expect(result[0]).toBeInstanceOf(FolderRef);
		});
	});

	describe("upload()", () => {
		test("rejects without an API key", async () => {
			await expect(client().upload(new File(["hi"], "hi.txt"))).rejects.toThrow(
				"An API key is required to upload files",
			);
		});

		test("one request per file — a mix of success and failure returns AssetRef/ErrorRef in order", async () => {
			let call = 0;
			globalThis.fetch = mock(async () => {
				call++;
				if (call === 2) {
					return new Response(JSON.stringify({ error: "Too many concurrent transforms" }), {
						status: 503,
					});
				}
				return new Response(
					JSON.stringify({ assets: [{ assetId: `asset_${call}`, filename: "f", mimeType: "text/plain", size: 1 }] }),
					{ status: 201 },
				);
			}) as unknown as typeof fetch;

			const result = await client("op_secret").upload(
				new File(["a"], "a.txt"),
				new File(["b"], "b.txt"),
				new File(["c"], "c.txt"),
			);
			expect(result).toHaveLength(3);
			expect(result[0]).toBeInstanceOf(AssetRef);
			expect(result[1]).toBeInstanceOf(ErrorRef);
			expect((result[1] as ErrorRef).filename).toBe("b.txt");
			expect((result[1] as ErrorRef).error).toBeInstanceOf(OSSPlayError);
			expect((result[1] as ErrorRef).error.code).toBe("rate_limited");
			expect(result[2]).toBeInstanceOf(AssetRef);
		});
	});

	test("asset(id) builds an AssetRef with no network call", () => {
		globalThis.fetch = mock(() => {
			throw new Error("should not fetch");
		}) as unknown as typeof fetch;
		const ref = client().asset("asset_1");
		expect(ref).toBeInstanceOf(AssetRef);
		expect(ref.id).toBe("asset_1");
	});

	test("folder(id) builds a FolderRef with no network call", () => {
		globalThis.fetch = mock(() => {
			throw new Error("should not fetch");
		}) as unknown as typeof fetch;
		expect(client().folder("folder_1")).toBeInstanceOf(FolderRef);
	});

	test("create(name) at root sends parentId: null", async () => {
		globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
			calls.push({ url: input.toString(), init });
			return new Response(JSON.stringify({ folder: { id: "folder_new", name: "photos" } }), {
				status: 201,
			});
		}) as unknown as typeof fetch;
		calls = [];
		await client("op_secret").create("photos");
		expect(JSON.parse(calls[0]?.init?.body as string)).toEqual({ name: "photos", parentId: null });
	});
});
