import { run } from "./cli";

run(process.argv.slice(2)).catch((error: unknown) => {
	console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
});
