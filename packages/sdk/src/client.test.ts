import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { OSSPlay } from "./client";
import { OSSPlayError } from "./http";

describe("OSSPlay", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	describe("image().url()", () => {
		test("builds a plain URL with no transform params or key", () => {
			const client = new OSSPlay({ endpoint: "https://media.example.com", project: "my-proj" });
			expect(client.image("asset_1").url()).toBe(
				"https://media.example.com/api/v1/my-proj/asset_1",
			);
		});

		test("includes transform params and the key as access_key", () => {
			const client = new OSSPlay({
				endpoint: "https://media.example.com/",
				apiKey: "op_secret",
				project: "my-proj",
			});
			const url = new URL(client.image("asset_1", { w: 800, format: "webp", q: 80 }).url());
			expect(url.pathname).toBe("/api/v1/my-proj/asset_1");
			expect(url.searchParams.get("w")).toBe("800");
			expect(url.searchParams.get("format")).toBe("webp");
			expect(url.searchParams.get("q")).toBe("80");
			expect(url.searchParams.get("access_key")).toBe("op_secret");
		});
	});

	describe("files", () => {
		let calls: { url: string; init?: RequestInit }[];

		beforeEach(() => {
			calls = [];
			globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
				calls.push({ url: input.toString(), init });
				return new Response(JSON.stringify({ folders: [], assets: [] }), { status: 200 });
			}) as unknown as typeof fetch;
		});

		test("list() sends the header auth form and folder query", async () => {
			const client = new OSSPlay({
				endpoint: "https://media.example.com",
				apiKey: "op_secret",
				project: "my-proj",
			});
			await client.files.list({ folder: "folder_1" });
			expect(calls).toHaveLength(1);
			const url = new URL(calls[0]?.url ?? "");
			expect(url.pathname).toBe("/api/v1/my-proj");
			expect(url.searchParams.get("folder")).toBe("folder_1");
			const headers = new Headers(calls[0]?.init?.headers);
			expect(headers.get("X-Api-Key")).toBe("op_secret");
		});

		test("upload() rejects without an API key", async () => {
			const client = new OSSPlay({ endpoint: "https://media.example.com", project: "my-proj" });
			await expect(client.files.upload(new File(["hi"], "hi.txt"))).rejects.toThrow(
				"An API key is required to upload files",
			);
		});

		test("delete() rejects without an API key", async () => {
			const client = new OSSPlay({ endpoint: "https://media.example.com", project: "my-proj" });
			await expect(client.files.delete("asset_1")).rejects.toThrow(
				"An API key is required to delete files",
			);
		});

		test("non-2xx responses throw OSSPlayError with the server's message", async () => {
			globalThis.fetch = mock(
				async () =>
					new Response(JSON.stringify({ error: "Missing or invalid API key" }), { status: 401 }),
			) as unknown as typeof fetch;
			const client = new OSSPlay({
				endpoint: "https://media.example.com",
				apiKey: "op_bad",
				project: "my-proj",
			});
			await expect(client.files.list()).rejects.toThrow(OSSPlayError);
		});
	});
});
