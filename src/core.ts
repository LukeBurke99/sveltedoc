/**
 * Escape special characters in a string for use within a RegExp.
 */
export function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns true if the character is a string delimiter quote.
 */
export function isQuote(ch: string): ch is '"' | "'" | '`' {
	return ch === '"' || ch === "'" || ch === '`';
}

/**
 * Split a string on the first occurrence of a delimiter.
 */
export function splitOnce(text: string, delimiter: string): [string, string | undefined] {
	const idx = text.indexOf(delimiter);
	return idx === -1
		? [text, undefined]
		: [text.slice(0, idx), text.slice(idx + delimiter.length)];
}

/**
 * Top-level aware split by a separator (comma or ampersand), respecting nested pairs.
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
 * Scan forward until the next top-level semicolon.
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

/**
 * Convert a simple glob-like pattern using * into a RegExp.
 */
export function wildcardToRegex(pattern: string): RegExp {
	const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
	return new RegExp(`^${escaped}$`);
}
