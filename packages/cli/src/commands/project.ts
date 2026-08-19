import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { type ImageFormat, OSSPlay } from "@ossplay/sdk";
import { getConnection } from "../config";
import { mimeTypeForFilename } from "../mime";
import { printTable } from "../table";

async function clientFor(project: string): Promise<OSSPlay> {
	const connection = await getConnection(project);
	if (!connection) {
		throw new Error(`No connection configured for "${project}" — run "op configure" first.`);
	}
	return new OSSPlay({ endpoint: connection.endpoint, apiKey: connection.apiKey, project });
}

export async function projectLs(project: string, options: { folder?: string }): Promise<void> {
	const client = await clientFor(project);
	const result = await client.files.list({ folder: options.folder });
	if (result.folders.length > 0) {
		console.log("Folders:");
		printTable(
			result.folders.map((f) => [f.id, f.name]),
			["ID", "NAME"],
		);
		console.log();
	}
	console.log("Assets:");
	printTable(
		result.assets.map((a) => [a.id, a.filename, a.mimeType, String(a.size), a.status]),
		["ID", "FILENAME", "MIME TYPE", "SIZE", "STATUS"],
	);
}

export interface GetOptions {
	output?: string;
	w?: number;
	h?: number;
	format?: ImageFormat;
	q?: number;
}

export async function projectGet(
	project: string,
	assetId: string,
	options: GetOptions,
): Promise<void> {
	const client = await clientFor(project);
	const hasTransform = options.w || options.h || options.format || options.q;
	const blob = hasTransform
		? await client.image(assetId, options).blob()
		: await client.files.download(assetId);

	const outputPath = options.output ?? assetId;
	await writeFile(outputPath, Buffer.from(await blob.arrayBuffer()));
	console.log(`Saved to ${outputPath} (${blob.size} bytes)`);
}

export async function projectDelete(project: string, assetId: string): Promise<void> {
	const client = await clientFor(project);
	await client.files.delete(assetId);
	console.log(`Deleted ${assetId}`);
}

export async function projectUpload(project: string, filePaths: string[]): Promise<void> {
	const client = await clientFor(project);
	const files = await Promise.all(
		filePaths.map(async (filePath) => {
			const data = await readFile(filePath);
			return {
				data: new Uint8Array(data),
				filename: basename(filePath),
				mimeType: mimeTypeForFilename(filePath),
			};
		}),
	);
	const uploaded = await client.files.upload(...files);
	printTable(
		uploaded.map((a) => [a.assetId, a.filename, a.mimeType, String(a.size)]),
		["ID", "FILENAME", "MIME TYPE", "SIZE"],
	);
}
