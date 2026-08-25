import { describe, expect, test } from "bun:test";
import { parseFlags, parseTranscodeSpec, run } from "./cli";

describe("parseFlags", () => {
	test("splits positional args from --flag value pairs", () => {
		const result = parseFlags(["asset_1", "--folder", "/a/b", "--w", "800"]);
		expect(result.positional).toEqual(["asset_1"]);
		expect(result.flags).toEqual({ folder: "/a/b", w: "800" });
	});

	test("-o is shorthand for --output", () => {
		const result = parseFlags(["asset_1", "-o", "./out.png"]);
		expect(result.flags.output).toBe("./out.png");
	});

	test("--attachment is a boolean flag with no following value consumed", () => {
		const result = parseFlags(["asset_1", "--attachment"]);
		expect(result.flags.attachment).toBe("true");
		expect(result.positional).toEqual(["asset_1"]);
	});

	test("throws when a value-taking flag has nothing after it", () => {
		expect(() => parseFlags(["--folder"])).toThrow("Missing value for --folder");
	});

	test("multiple positional args are preserved in order", () => {
		const result = parseFlags(["a.jpg", "b.jpg", "c.jpg"]);
		expect(result.positional).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
	});
});

describe("parseTranscodeSpec", () => {
	test("--height builds a video-transcode spec, defaulting format to mp4", () => {
		expect(parseTranscodeSpec({ height: "720" })).toEqual({
			kind: "video-transcode",
			height: 720,
			format: "mp4",
		});
	});

	test("--height with --format webm", () => {
		expect(parseTranscodeSpec({ height: "1080", format: "webm" })).toEqual({
			kind: "video-transcode",
			height: 1080,
			format: "webm",
		});
	});

	test("rejects an invalid --height", () => {
		expect(() => parseTranscodeSpec({ height: "600" })).toThrow("--height must be 480, 720, or 1080");
	});

	test("--bitrate builds an audio-transcode spec", () => {
		expect(parseTranscodeSpec({ bitrate: "128k" })).toEqual({ kind: "audio-transcode", bitrate: "128k" });
	});

	test("rejects an invalid --bitrate", () => {
		expect(() => parseTranscodeSpec({ bitrate: "64k" })).toThrow(
			"--bitrate must be 96k, 128k, 192k, or 320k",
		);
	});

	test("--hls builds an hls-package spec", () => {
		expect(parseTranscodeSpec({ hls: "true" })).toEqual({ kind: "hls-package" });
	});

	test("throws with no recognized flag", () => {
		expect(() => parseTranscodeSpec({})).toThrow(/Usage: op <project> transcode/);
	});
});

describe("run() argument validation", () => {
	test("prints usage with --help", async () => {
		await expect(run(["--help"])).resolves.toBeUndefined();
	});

	test("upload with no files throws before touching the network", async () => {
		await expect(run(["my-project", "upload"])).rejects.toThrow(
			"Usage: op <project> upload <file...>",
		);
	});

	test("mkdir with no target throws", async () => {
		await expect(run(["my-project", "mkdir"])).rejects.toThrow(
			"Usage: op <project> mkdir <name-or-/path>",
		);
	});

	test("mv with no assetId throws", async () => {
		await expect(run(["my-project", "mv"])).rejects.toThrow(/Usage: op <project> mv/);
	});

	test("transcode with no assetId throws", async () => {
		await expect(run(["my-project", "transcode"])).rejects.toThrow(/Usage: op <project> transcode/);
	});
});
