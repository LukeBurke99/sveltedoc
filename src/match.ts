import { escapeRegExp } from './core';

/**
 * Convert a simple glob to a regex pattern string.
 *
 * Supports:
 *  - `**` for multi-segment matches (can include slashes)
 *  - `*` for single-segment matches (no slash)
 * Escapes other regular expression metacharacters.
 *
 * @param glob - The glob pattern to convert.
 * @returns A regex source string suitable for constructing a RegExp.
 */
export function globToRegex(glob: string): string {
	// Protect ** so single-star handling won't affect it
	const DDSTAR = '\u0000';
	let s = glob.replace(/\*\*/g, DDSTAR);
	// Escape all regex meta (including '?'), then reintroduce star semantics
	s = escapeRegExp(s);
	// Single * (escaped as \*) => any chars except '/'
	s = s.replace(/\\\*/g, '[^/]*');
	// Restore ** => any chars, including '/'
	s = s.replace(new RegExp(DDSTAR, 'g'), '.*');
	return s;
}

/**
 * Test whether a normalized relative path matches any of the provided glob patterns.
 *
 * Paths are normalized to use forward slashes before matching.
 *
 * @param relPath - A relative path using either backslashes or forward slashes.
 * @param patterns - One or more glob patterns to test against.
 * @returns True if any pattern matches the path.
 */
export function fileMatchesPath(relPath: string, patterns: string[]): boolean {
	const rel = relPath.replace(/\\/g, '/');
	return patterns.some((p) => new RegExp('^' + globToRegex(p) + '$').test(rel));
}
