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
	const ESCAPE_RE = /[.+^${}()|[\]\\]/g;
	// Escape regex specials first
	let s = glob.replace(ESCAPE_RE, (ch) => `\\${ch}`);
	// Protect ** so the single * replacement won't affect it
	const DDSTAR = '\u0000';
	s = s.replace(/\*\*/g, DDSTAR);
	// Single * = any chars except '/'
	s = s.replace(/\*/g, '[^/]*');
	// Restore ** = any chars, including '/'
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
