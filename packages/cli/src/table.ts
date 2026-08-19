export function printTable(rows: string[][], headers: string[]): void {
	if (rows.length === 0) {
		console.log("(none)");
		return;
	}
	const widths = headers.map((header, i) =>
		Math.max(header.length, ...rows.map((row) => (row[i] ?? "").length)),
	);
	const line = (cells: string[]) => cells.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join("  ");
	console.log(line(headers));
	console.log(line(widths.map((w) => "-".repeat(w))));
	for (const row of rows) console.log(line(row));
}
