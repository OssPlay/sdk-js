import type { ImageFormat, RenditionSpec } from "@ossplay/sdk";
import { configure, configureList } from "./commands/configure";
import { folderCreate, folderDelete, folderGet } from "./commands/folders";
import {
	type GetOptions,
	projectDelete,
	projectGet,
	projectInfo,
	projectLs,
	projectMove,
	projectTranscode,
	projectUpload,
	projectUrl,
	projectVariants,
} from "./commands/project";

const USAGE = `Usage:
  op configure                       Save a connection (instance URL + API key) for a project
  op configure ls                    List configured connections
  op <project> ls [--folder <id-or-path>]              List a project's files
  op <project> get <assetId> [-o <path>] [--w <n>] [--h <n>] [--format <fmt>] [--q <n>]
  op <project> upload <file...> [--folder <id-or-path>] Upload one or more local files
  op <project> delete <assetId>      Delete a file
  op <project> mkdir <name-or-/path>              Create a folder (a leading "/" creates every missing segment)
  op <project> folders [id-or-path]               Show a folder (root, if omitted)
  op <project> rmdir <folderId>                   Delete a folder
  op <project> mv <assetId> [--to <folder>] [--name <filename>]  Rename and/or move a file
  op <project> info <assetId>        Show a file's metadata
  op <project> url <assetId> [--attachment]        Get a direct download URL
  op <project> transcode <assetId> --height <n>|--bitrate <n>k [--format <fmt>]  Request a rendition
  op <project> variants <assetId>    List an asset's renditions`;

// Flags are parsed positionally (no external arg-parsing dependency) — the
// command set is small and fixed enough that this stays simple. Exported for
// direct unit testing (see cli.test.ts) — run() itself needs a live
// connection (getConnection/fetch) to test end to end, but the parsing logic
// doesn't.
export function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string> } {
	const positional: string[] = [];
	const flags: Record<string, string> = {};
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "-o" || arg?.startsWith("--")) {
			const name = arg === "-o" ? "output" : arg.slice(2);
			// A handful of flags are booleans (no value follows) — everything
			// else expects one.
			if (name === "attachment") {
				flags[name] = "true";
				continue;
			}
			const value = args[++i];
			if (value === undefined) throw new Error(`Missing value for ${arg}`);
			flags[name] = value;
		} else if (arg !== undefined) {
			positional.push(arg);
		}
	}
	return { positional, flags };
}

function toInt(value: string | undefined): number | undefined {
	return value === undefined ? undefined : Number.parseInt(value, 10);
}

export function parseTranscodeSpec(flags: Record<string, string>): RenditionSpec {
	if (flags.height) {
		const height = toInt(flags.height);
		if (height !== 480 && height !== 720 && height !== 1080) {
			throw new Error("--height must be 480, 720, or 1080");
		}
		const format = flags.format === "webm" ? "webm" : "mp4";
		return { kind: "video-transcode", height, format };
	}
	if (flags.bitrate) {
		const bitrate = flags.bitrate;
		if (bitrate !== "96k" && bitrate !== "128k" && bitrate !== "192k" && bitrate !== "320k") {
			throw new Error("--bitrate must be 96k, 128k, 192k, or 320k");
		}
		return { kind: "audio-transcode", bitrate };
	}
	if (flags.hls) return { kind: "hls-package" };
	throw new Error("Usage: op <project> transcode <assetId> --height <n>|--bitrate <n>k|--hls");
}

export async function run(argv: string[]): Promise<void> {
	const [first, ...rest] = argv;

	if (!first || first === "--help" || first === "-h") {
		console.log(USAGE);
		return;
	}

	if (first === "configure") {
		if (rest[0] === "ls") await configureList();
		else await configure();
		return;
	}

	const project = first;
	const [subcommand, ...subArgs] = rest;
	const { positional, flags } = parseFlags(subArgs);

	switch (subcommand) {
		case "ls":
			await projectLs(project, { folder: flags.folder });
			return;
		case "get": {
			const assetId = positional[0];
			if (!assetId) throw new Error("Usage: op <project> get <assetId>");
			const options: GetOptions = {
				output: flags.output,
				w: toInt(flags.w),
				h: toInt(flags.h),
				format: flags.format as ImageFormat | undefined,
				q: toInt(flags.q),
			};
			await projectGet(project, assetId, options);
			return;
		}
		case "upload":
			if (positional.length === 0) throw new Error("Usage: op <project> upload <file...>");
			await projectUpload(project, positional, { folder: flags.folder });
			return;
		case "delete": {
			const assetId = positional[0];
			if (!assetId) throw new Error("Usage: op <project> delete <assetId>");
			await projectDelete(project, assetId);
			return;
		}
		case "mkdir": {
			const target = positional[0];
			if (!target) throw new Error("Usage: op <project> mkdir <name-or-/path>");
			await folderCreate(project, target);
			return;
		}
		case "folders":
			await folderGet(project, positional[0]);
			return;
		case "rmdir": {
			const folderId = positional[0];
			if (!folderId) throw new Error("Usage: op <project> rmdir <folderId>");
			await folderDelete(project, folderId);
			return;
		}
		case "mv": {
			const assetId = positional[0];
			if (!assetId) throw new Error("Usage: op <project> mv <assetId> [--to <folder>] [--name <filename>]");
			await projectMove(project, assetId, { to: flags.to, name: flags.name });
			return;
		}
		case "info": {
			const assetId = positional[0];
			if (!assetId) throw new Error("Usage: op <project> info <assetId>");
			await projectInfo(project, assetId);
			return;
		}
		case "url": {
			const assetId = positional[0];
			if (!assetId) throw new Error("Usage: op <project> url <assetId> [--attachment]");
			await projectUrl(project, assetId, { disposition: flags.attachment ? "attachment" : undefined });
			return;
		}
		case "transcode": {
			const assetId = positional[0];
			if (!assetId) throw new Error("Usage: op <project> transcode <assetId> --height <n>|--bitrate <n>k");
			await projectTranscode(project, assetId, parseTranscodeSpec(flags));
			return;
		}
		case "variants": {
			const assetId = positional[0];
			if (!assetId) throw new Error("Usage: op <project> variants <assetId>");
			await projectVariants(project, assetId);
			return;
		}
		default:
			console.log(USAGE);
	}
}
