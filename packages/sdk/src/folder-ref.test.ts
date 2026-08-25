import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { OSSPlay } from "./client";
import { FolderRef } from "./folder-ref";

describe("FolderRef", () => {
	const originalFetch = globalThis.fetch;
	let calls: { url: string; method: string; body?: unknown }[];

	beforeEach(() => {
		calls = [];
	});
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	function mockFetch(handler: (url: URL, method: string, body?: unknown) => Response) {
		globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = new URL(input.toString());
			const method = init?.method ?? "GET";
			const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
			calls.push({ url: url.pathname + url.search, method, body });
			return handler(url, method, body);
		}) as unknown as typeof fetch;
	}

	const client = () =>
		new OSSPlay({ endpoint: "https://media.example.com", apiKey: "op_secret", project: "my-proj" });

	describe("target is always absolute, not relative to the ref it came from", () => {
		test("folder(id) on a non-root ref still resolves that exact id, not a child of the parent", async () => {
			mockFetch(() => new Response(JSON.stringify({ folders: [], assets: [] }), { status: 200 }));
			await client().folder("folder_a").folder("folder_b").list();
			expect(calls[0]?.url).toBe("/api/v1/my-proj?folder=folder_b");
		});

		test("folder(path) is a project-root path regardless of the calling ref", async () => {
			mockFetch(() => new Response(JSON.stringify({ folders: [], assets: [] }), { status: 200 }));
			await client().folder("folder_a").folder("/x/y").list();
			expect(calls[0]?.url).toBe("/api/v1/my-proj?folder=%2Fx%2Fy");
		});
	});

	describe("{ create: true }", () => {
		test("a path target is ensured (idempotently) before the first read, then reused", async () => {
			mockFetch((url) => {
				if (url.pathname.endsWith("/folders") && url.search === "") {
					return new Response(JSON.stringify({ folder: { id: "folder_x", name: "y" } }), { status: 201 });
				}
				return new Response(JSON.stringify({ folders: [], assets: [] }), { status: 200 });
			});
			const ref = client().folder("/x/y", { create: true });
			await ref.list();
			await ref.info; // second op on the same ref — must not ensure a second time

			const ensureCalls = calls.filter((c) => c.method === "POST" && c.url === "/api/v1/my-proj/folders");
			expect(ensureCalls).toHaveLength(1);
			expect(ensureCalls[0]?.body).toEqual({ path: "/x/y" });
		});

		test("a bare name is treated as a root-level path, not a literal id", async () => {
			mockFetch((url) => {
				if (url.pathname.endsWith("/folders") && url.search === "") {
					return new Response(JSON.stringify({ folder: { id: "folder_x", name: "vacation" } }), {
						status: 201,
					});
				}
				return new Response(JSON.stringify({ folders: [], assets: [] }), { status: 200 });
			});
			await client().folder("vacation", { create: true }).list();
			const ensureCall = calls.find((c) => c.method === "POST");
			expect(ensureCall?.body).toEqual({ path: "/vacation" });
			const listCall = calls.find((c) => c.method === "GET");
			expect(listCall?.url).toBe("/api/v1/my-proj?folder=%2Fvacation");
		});

		test("without { create: true }, a bare string is a literal id — no ensure call", async () => {
			mockFetch(() => new Response(JSON.stringify({ folders: [], assets: [] }), { status: 200 }));
			await client().folder("folder_x").list();
			expect(calls).toHaveLength(1);
			expect(calls[0]?.method).toBe("GET");
			expect(calls[0]?.url).toBe("/api/v1/my-proj?folder=folder_x");
		});
	});

	describe("create(name) — relative child of this ref", () => {
		test("uses this ref's own resolved id as parentId", async () => {
			mockFetch((url) =>
				url.pathname.endsWith("/folders")
					? new Response(JSON.stringify({ folder: { id: "folder_child", name: "sub" } }), { status: 201 })
					: new Response("unexpected", { status: 500 }),
			);
			await client().folder("folder_parent").create("sub");
			expect(calls[0]?.body).toEqual({ name: "sub", parentId: "folder_parent" });
		});
	});

	describe("rename/move/delete", () => {
		test("a path-based ref resolves its real id lazily, once, before the first mutation", async () => {
			mockFetch((url, method) => {
				if (method === "GET" && url.pathname.endsWith("/folders") && url.searchParams.get("path")) {
					return new Response(JSON.stringify({ folder: { id: "folder_real" } }), { status: 200 });
				}
				return new Response(JSON.stringify({ folder: { id: "folder_real", name: "new" } }), { status: 200 });
			});
			const ref = client().folder("/a/b");
			await ref.rename("new");
			await ref.move(null); // second mutation on the same ref — id must be reused, not re-resolved

			const resolveCalls = calls.filter((c) => c.method === "GET");
			expect(resolveCalls).toHaveLength(1);
			const patchCalls = calls.filter((c) => c.method === "PATCH");
			expect(patchCalls).toHaveLength(2);
			expect(patchCalls.every((c) => c.url === "/api/v1/my-proj/folders/folder_real")).toBe(true);
		});

		test("an id-based ref never needs to resolve anything first", async () => {
			mockFetch(() => new Response(JSON.stringify({ folder: { id: "folder_1", name: "new" } }), { status: 200 }));
			await client().folder("folder_1").rename("new");
			expect(calls).toHaveLength(1);
			expect(calls[0]?.method).toBe("PATCH");
		});

		test("delete() resolves an id the same way", async () => {
			mockFetch(() => new Response(null, { status: 204 }));
			await client().folder("folder_1").delete();
			expect(calls[0]?.method).toBe("DELETE");
			expect(calls[0]?.url).toBe("/api/v1/my-proj/folders/folder_1");
		});
	});

	describe("createUploadUrl(...)", () => {
		test("posts to /uploads with the given metadata and returns the target as-is", async () => {
			mockFetch(() =>
				new Response(
					JSON.stringify({
						assetId: "asset_1",
						uploadUrl: "https://bucket.s3.example.com/signed",
						method: "PUT",
						expiresAt: "2026-01-01T00:00:00.000Z",
					}),
					{ status: 201 },
				),
			);
			const target = await client().createUploadUrl({ filename: "video.mp4", mimeType: "video/mp4" });
			expect(calls[0]?.method).toBe("POST");
			expect(calls[0]?.url).toBe("/api/v1/my-proj/uploads");
			expect(calls[0]?.body).toEqual({ filename: "video.mp4", mimeType: "video/mp4" });
			expect(target).toEqual({
				assetId: "asset_1",
				uploadUrl: "https://bucket.s3.example.com/signed",
				method: "PUT",
				expiresAt: "2026-01-01T00:00:00.000Z",
			});
		});

		test("scopes to this ref's folder the same way upload() does", async () => {
			mockFetch(() =>
				new Response(
					JSON.stringify({ assetId: "a", uploadUrl: "u", method: "PUT", expiresAt: "e" }),
					{ status: 201 },
				),
			);
			await client().folder("/a/b").createUploadUrl({ filename: "x.txt", mimeType: "text/plain" });
			expect(calls[0]?.url).toBe("/api/v1/my-proj/uploads?folder=%2Fa%2Fb");
		});

		test("throws without an API key, before making a request", async () => {
			mockFetch(() => new Response("unexpected", { status: 500 }));
			const noKeyClient = new OSSPlay({ endpoint: "https://media.example.com", project: "my-proj" });
			await expect(
				noKeyClient.createUploadUrl({ filename: "x.txt", mimeType: "text/plain" }),
			).rejects.toThrow("An API key is required");
			expect(calls).toHaveLength(0);
		});
	});

	describe("root guard", () => {
		test("rename()/move()/delete() throw a clear error on the root ref", async () => {
			await expect(client().rename("x")).rejects.toThrow("The root folder has no id");
			await expect(client().move(null)).rejects.toThrow("The root folder has no id");
			await expect(client().delete()).rejects.toThrow("The root folder has no id");
		});
	});

	test("client itself is a FolderRef", () => {
		expect(client()).toBeInstanceOf(FolderRef);
	});
});
