/** Convert a simple glob to a regex string.
 * Supports:
 *  - ** for multi-segment
 *  - * for single-segment (no slash)
 * Escapes other regex metacharacters.
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

/** Match a normalized relative path against one or more glob patterns. */
export function fileMatchesPath(relPath: string, patterns: string[]): boolean {
	const rel = relPath.replace(/\\/g, '/');
	return patterns.some((p) => new RegExp('^' + globToRegex(p) + '$').test(rel));
}
