/**
 * Parse a raw attribute string into a key-value map.
 * Handles attributes with and without values.
 * @param raw Raw attribute string
 * @returns Parsed attributes as a key-value map
 * @example
 * parseAttributes('lang="ts" module')
 * // Returns: { lang: 'ts', module: true }
 */
export function parseAttributes(raw: string): Record<string, string | true> {
	const attrs: Record<string, string | true> = {};
	const re = /(\w[\w:-]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(raw))) {
		const key = m[1];
		let val = m[2];
		if (val) {
			val = val.trim();
			attrs[key] =
				(val.startsWith('"') && val.endsWith('"')) ||
				(val.startsWith("'") && val.endsWith("'"))
					? val.slice(1, -1)
					: val;
		} else {
			attrs[key] = true;
		}
	}
	return attrs;
}
