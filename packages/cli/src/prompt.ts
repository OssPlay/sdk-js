import { createInterface, type Interface } from "node:readline";

const ENTER = new Set(["\n", "\r"]);
const CTRL_C = "\x03";
const BACKSPACE = new Set(["\x7f", "\b"]);

// A single shared readline interface for an entire prompt sequence,
// consumed via its async iterator rather than repeated .question() calls.
// Node's readline .question() (and even a fresh interface's very first
// .next()) only reliably reads a piped/non-TTY stdin ONCE — closing and
// reopening an interface mid-sequence silently drops whatever was left
// unread in the pipe (reproduced directly against Node 25). So this class
// keeps exactly one interface open for the whole sequence and never closes
// it until the caller is completely done asking questions.
export class Prompter {
	private rl: Interface | null;
	private lines: AsyncIterator<string>;

	constructor() {
		this.rl = createInterface({ input: process.stdin, output: process.stdout });
		this.lines = this.rl[Symbol.asyncIterator]();
	}

	async ask(question: string): Promise<string> {
		if (!this.rl) throw new Error("Prompter is closed");
		process.stdout.write(question);
		const { value, done } = await this.lines.next();
		if (done) throw new Error("Unexpected end of input");
		return value.trim();
	}

	// On a real TTY, masks the typed value with "*" via raw-mode input,
	// which needs sole control of stdin — so this closes the shared
	// readline interface first (safe here: a TTY delivers keystrokes live,
	// nothing is buffered ahead to lose, unlike a pipe). On non-TTY input
	// (e.g. a scripted/piped answer), there's no terminal to mask against,
	// so it just reads the next line through the same still-open interface.
	async askHidden(question: string): Promise<string> {
		if (!process.stdin.isTTY) return this.ask(question);
		this.close();

		return new Promise((resolve) => {
			process.stdout.write(question);
			let value = "";
			process.stdin.setRawMode(true);
			process.stdin.resume();
			process.stdin.setEncoding("utf8");

			const onData = (char: string) => {
				if (ENTER.has(char)) {
					process.stdin.setRawMode(false);
					process.stdin.pause();
					process.stdin.off("data", onData);
					process.stdout.write("\n");
					resolve(value);
					return;
				}
				if (char === CTRL_C) process.exit(130);
				if (BACKSPACE.has(char)) {
					value = value.slice(0, -1);
					return;
				}
				value += char;
				process.stdout.write("*");
			};
			process.stdin.on("data", onData);
		});
	}

	close(): void {
		this.rl?.close();
		this.rl = null;
	}
}
