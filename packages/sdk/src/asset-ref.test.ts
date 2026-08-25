import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { AssetRef } from "./asset-ref";
import { OSSPlay } from "./client";
import { ImageTransformRef } from "./image-transform-ref";

describe("AssetRef", () => {
	const originalFetch = globalThis.fetch;
	let calls: { url: string; method: string; body?: unknown }[];

	beforeEach(() => {
		calls = [];
	});
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	function mockFetch(handler: (url: URL, method: string) => Response) {
		globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = new URL(input.toString());
			const method = init?.method ?? "GET";
			const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
			calls.push({ url: url.pathname + url.search, method, body });
			return handler(url, method);
		}) as unknown as typeof fetch;
	}

	function asset(mimeType = "image/png"): AssetRef {
		mockFetch((url) => {
			if (url.pathname.endsWith("/info")) {
				return new Response(
					JSON.stringify({
						asset: {
							id: "asset_1",
							filename: "f",
							mimeType,
							size: 1,
							status: "ready",
							folderId: null,
							parentAssetId: null,
							createdAt: "",
							updatedAt: "",
						},
					}),
					{ status: 200 },
				);
			}
			return new Response("{}", { status: 200 });
		});
		return new OSSPlay({ endpoint: "https://media.example.com", apiKey: "op_secret", project: "my-proj" }).asset(
			"asset_1",
		);
	}

	test("id is exposed with zero network calls made just by constructing the ref", () => {
		globalThis.fetch = mock(() => {
			throw new Error("should not fetch");
		}) as unknown as typeof fetch;
		const ref = new OSSPlay({ endpoint: "https://media.example.com", project: "my-proj" }).asset("asset_1");
		expect(ref.id).toBe("asset_1");
	});

	test("info is a getter — no parens needed", async () => {
		const info = await asset().info;
		expect(info.id).toBe("asset_1");
	});

	describe("transform()", () => {
		test("returns an ImageTransformRef for an image asset", async () => {
			const ref = await asset("image/jpeg").transform({ w: 800 });
			expect(ref).toBeInstanceOf(ImageTransformRef);
		});

		test("throws for a non-image asset without ever building a transform ref", async () => {
			await expect(asset("video/mp4").transform({ w: 800 })).rejects.toThrow(
				"transform() only applies to images",
			);
		});
	});

	describe("requestRendition()", () => {
		test("throws for a non-video/audio asset", async () => {
			await expect(asset("image/png").requestRendition({ kind: "hls-package" })).rejects.toThrow(
				"requestRendition() only applies to video/audio",
			);
		});

		test("posts the spec and returns an AssetRef for the resulting variant", async () => {
			const ref = asset("video/mp4");
			mockFetch((url, method) => {
				if (url.pathname.endsWith("/info")) {
					return new Response(
						JSON.stringify({ asset: { id: "asset_1", mimeType: "video/mp4", filename: "f", size: 1, status: "ready" } }),
						{ status: 200 },
					);
				}
				if (method === "POST" && url.pathname.endsWith("/variants")) {
					return new Response(JSON.stringify({ asset: { id: "asset_variant" } }), { status: 202 });
				}
				return new Response("{}", { status: 200 });
			});
			const variant = await ref.requestRendition({ kind: "hls-package" });
			expect(variant).toBeInstanceOf(AssetRef);
			expect(variant.id).toBe("asset_variant");
		});
	});

	describe("embed()", () => {
		test("throws for a non-video asset", async () => {
			await expect(asset("image/png").embed()).rejects.toThrow("embed() only applies to video");
		});
	});

	describe("url()", () => {
		test("direct: true throws when the URL is same-origin (proxied, not real storage)", async () => {
			mockFetch((url) =>
				url.pathname.endsWith("/url")
					? new Response(JSON.stringify({ url: "https://media.example.com/api/v1/my-proj/asset_1" }), {
							status: 200,
						})
					: new Response("{}", { status: 200 }),
			);
			const ref = new OSSPlay({
				endpoint: "https://media.example.com",
				apiKey: "op_secret",
				project: "my-proj",
			}).asset("asset_1");
			await expect(ref.url({ direct: true })).rejects.toThrow("No direct storage URL is available");
		});

		test("direct: true succeeds when the URL is a real external origin", async () => {
			mockFetch((url) =>
				url.pathname.endsWith("/url")
					? new Response(JSON.stringify({ url: "https://bucket.s3.amazonaws.com/key", expiresIn: 3600 }), {
							status: 200,
						})
					: new Response("{}", { status: 200 }),
			);
			const ref = new OSSPlay({
				endpoint: "https://media.example.com",
				apiKey: "op_secret",
				project: "my-proj",
			}).asset("asset_1");
			const result = await ref.url({ direct: true });
			expect(result.url).toBe("https://bucket.s3.amazonaws.com/key");
		});
	});

	test("confirmUpload() POSTs to .../confirm with no body and returns the confirmed asset", async () => {
		mockFetch(() =>
			new Response(
				JSON.stringify({
					asset: {
						id: "asset_1",
						filename: "f",
						mimeType: "text/plain",
						size: 3,
						status: "ready",
						folderId: null,
						parentAssetId: null,
						createdAt: "",
						updatedAt: "",
					},
				}),
				{ status: 200 },
			),
		);
		const result = await new OSSPlay({
			endpoint: "https://media.example.com",
			apiKey: "op_secret",
			project: "my-proj",
		})
			.asset("asset_1")
			.confirmUpload();
		expect(calls[0]?.method).toBe("POST");
		expect(calls[0]?.url).toBe("/api/v1/my-proj/asset_1/confirm");
		expect(calls[0]?.body).toBeUndefined();
		expect(result.status).toBe("ready");
	});

	test("delete() DELETEs the asset", async () => {
		mockFetch(() => new Response(null, { status: 204 }));
		await new OSSPlay({ endpoint: "https://media.example.com", apiKey: "op_secret", project: "my-proj" })
			.asset("asset_1")
			.delete();
		expect(calls[0]?.method).toBe("DELETE");
		expect(calls[0]?.url).toBe("/api/v1/my-proj/asset_1");
	});
});
