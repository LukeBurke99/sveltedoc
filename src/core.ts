// core functions

//#region String and regex helpers

/**
 * Escape special characters in a string for safe use within a RegExp pattern.
 *
 * @param s - The input string to escape.
 * @returns A new string where regex metacharacters are escaped.
 */
export function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check whether a character is a string delimiter quote.
 *
 * Acts as a type guard for common quote characters.
 *
 * @param ch - The character to test.
 * @returns True if the character is a single quote, double quote, or backtick.
 */
export function isQuote(ch: string): ch is '"' | "'" | '`' {
	return ch === '"' || ch === "'" || ch === '`';
}

/**
 * Split a string on the first occurrence of a delimiter.
 *
 * @param text - The text to split.
 * @param delimiter - The delimiter to split on.
 * @returns A tuple where the first item is the text before the first delimiter,
 *          and the second item is the remainder after the delimiter (or undefined if not found).
 */
export function splitOnce(text: string, delimiter: string): [string, string | undefined] {
	const idx = text.indexOf(delimiter);
	return idx === -1
		? [text, undefined]
		: [text.slice(0, idx), text.slice(idx + delimiter.length)];
}

//#endregion

//#region Top-level parsing helpers

/**
 * Split a string by a separator only at the top level, respecting nested (), {}, [], and <> pairs,
 * and quoted strings. Useful for splitting TypeScript type literals and intersections.
 *
 * @param input - The input string to split.
 * @param sep - The separator character to split on, either ',' or '&'.
 * @returns An array of top-level segments.
 */
export function splitTopLevel(input: string, sep: ',' | '&'): string[] {
	const parts: string[] = [];
	let depthParens = 0;
	let depthBraces = 0;
	let depthBrackets = 0;
	let depthAngles = 0;
	let current = '';
	let inString: '"' | "'" | '`' | null = null;
	for (let i = 0; i < input.length; i++) {
		const ch = input[i];
		const prev = i > 0 ? input[i - 1] : '';
		if (inString) {
			current += ch;
			if (ch === inString && prev !== '\\') inString = null;
			continue;
		}
		if (isQuote(ch)) {
			inString = ch;
			current += ch;
			continue;
		}
		switch (ch) {
			case '(':
				depthParens++;
				break;
			case ')':
				depthParens = Math.max(0, depthParens - 1);
				break;
			case '{':
				depthBraces++;
				break;
			case '}':
				depthBraces = Math.max(0, depthBraces - 1);
				break;
			case '[':
				depthBrackets++;
				break;
			case ']':
				depthBrackets = Math.max(0, depthBrackets - 1);
				break;
			case '<':
				depthAngles++;
				break;
			case '>':
				depthAngles = Math.max(0, depthAngles - 1);
				break;
			default:
				break;
		}
		if (
			depthParens === 0 &&
			depthBraces === 0 &&
			depthBrackets === 0 &&
			depthAngles === 0 &&
			ch === sep
		) {
			parts.push(current);
			current = '';
			continue;
		}
		current += ch;
	}
	if (current.trim()) parts.push(current);
	return parts;
}

/**
 * Scan code forward from a given index until the next top-level semicolon.
 * Skips over nested (), {}, [], <> and respects quoted strings and comments.
 *
 * @param code - The full source code to scan.
 * @param startIndex - The index at which to begin scanning.
 * @returns The index of the next top-level semicolon or -1 if none is found.
 */
export function scanToTopLevelSemicolon(code: string, startIndex: number): number {
	let depthParens = 0;
	let depthBraces = 0;
	let depthBrackets = 0;
	let depthAngles = 0;
	let inString: '"' | "'" | '`' | null = null;
	let inLineComment = false;
	let inBlockComment = false;
	for (let i = startIndex; i < code.length; i++) {
		const ch = code[i];
		const next = i + 1 < code.length ? code[i + 1] : '';
		const prev = i > 0 ? code[i - 1] : '';
		if (inLineComment) {
			if (ch === '\n') inLineComment = false;
			continue;
		}
		if (inBlockComment) {
			if (ch === '*' && next === '/') {
				inBlockComment = false;
				i++;
			}
			continue;
		}
		if (!inString && ch === '/' && next === '/') {
			inLineComment = true;
			i++;
			continue;
		}
		if (!inString && ch === '/' && next === '*') {
			inBlockComment = true;
			i++;
			continue;
		}
		if (inString) {
			if (ch === inString && prev !== '\\') inString = null;
			continue;
		}
		if (isQuote(ch)) {
			inString = ch;
			continue;
		}
		switch (ch) {
			case '(':
				depthParens++;
				break;
			case ')':
				depthParens = Math.max(0, depthParens - 1);
				break;
			case '{':
				depthBraces++;
				break;
			case '}':
				depthBraces = Math.max(0, depthBraces - 1);
				break;
			case '[':
				depthBrackets++;
				break;
			case ']':
				depthBrackets = Math.max(0, depthBrackets - 1);
				break;
			case '<':
				depthAngles++;
				break;
			case '>':
				depthAngles = Math.max(0, depthAngles - 1);
				break;
			case ';':
				if (
					depthParens === 0 &&
					depthBraces === 0 &&
					depthBrackets === 0 &&
					depthAngles === 0
				)
					return i;
				break;
			default:
				break;
		}
	}
	return -1;
}

//#endregion

//#region Pattern helpers

/**
 * Convert a simple glob-like pattern using '*' wildcards into a RegExp.
 *
 * @param pattern - The glob-like pattern where '*' matches any sequence (including empty).
 * @returns A RegExp that matches the entire input string against the pattern.
 */
export function wildcardToRegex(pattern: string): RegExp {
	const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
	return new RegExp(`^${escaped}$`);
}

//#endregion
