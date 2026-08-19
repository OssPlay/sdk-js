const EXTENSION_TO_MIME: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
	avif: "image/avif",
	gif: "image/gif",
	svg: "image/svg+xml",
	mp4: "video/mp4",
	webm: "video/webm",
	mov: "video/quicktime",
	mp3: "audio/mpeg",
	wav: "audio/wav",
	pdf: "application/pdf",
	json: "application/json",
	txt: "text/plain",
	csv: "text/csv",
	zip: "application/zip",
};

export function mimeTypeForFilename(filename: string): string {
	const ext = filename.split(".").pop()?.toLowerCase();
	return (ext && EXTENSION_TO_MIME[ext]) || "application/octet-stream";
}
