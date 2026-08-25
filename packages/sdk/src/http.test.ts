import { describe, expect, test } from "bun:test";
import { OSSPlayError, throwForStatus } from "./http";

async function errorFor(status: number, body: unknown = { error: "boom" }): Promise<OSSPlayError> {
	const response = new Response(JSON.stringify(body), { status, statusText: "Custom Status Text" });
	try {
		await throwForStatus(response);
		throw new Error("throwForStatus did not throw");
	} catch (err) {
		if (!(err instanceof OSSPlayError)) throw err;
		return err;
	}
}

describe("OSSPlayError.code", () => {
	test.each([
		[404, "not_found"],
		[401, "unauthorized"],
		[409, "conflict"],
		[400, "invalid_input"],
		[425, "not_ready"],
		[503, "rate_limited"],
		[500, "unknown"],
		[418, "unknown"],
	] as const)("status %i maps to code %s", async (status, code) => {
		const err = await errorFor(status);
		expect(err.code).toBe(code);
		expect(err.status).toBe(status);
	});

	test("carries the server's error message when the body is JSON", async () => {
		const err = await errorFor(404, { error: "Asset not found" });
		expect(err.message).toBe("Asset not found");
	});

	test("falls back to statusText when the body isn't JSON", async () => {
		const response = new Response("not json", { status: 500, statusText: "Custom Status Text" });
		await expect(throwForStatus(response)).rejects.toThrow("Custom Status Text");
	});

	test("a caller-constructed OSSPlayError also gets an inferred code by default", () => {
		const err = new OSSPlayError("nope", 409);
		expect(err.code).toBe("conflict");
	});

	test("an explicit code overrides the inferred one", () => {
		const err = new OSSPlayError("nope", 500, "rate_limited");
		expect(err.code).toBe("rate_limited");
	});
});
