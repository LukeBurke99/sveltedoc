/**
 * BaseScanner: Abstract base class for character-by-character scanning operations.
 *
 * Provides common functionality for scanning text including:
 * - Position tracking and navigation
 * - String literal detection and handling
 * - Depth tracking for nested structures
 *
 * Subclasses implement specific parsing logic while reusing core navigation.
 */

export abstract class BaseScanner {
	protected body: string;
	protected pos: number = 0;
	protected depth: number = 0;

	// String literal tracking
	// When inString=true, ALL characters are accumulated until the matching closing quote.
	// This prevents comment syntax or braces inside strings from being processed.
	protected inString: boolean = false;
	protected stringChar: string = ''; // Which quote started this string: ", ', or `

	public constructor(body: string) {
		this.body = body;
	}

	/**
	 * Get the character at the current position.
	 */
	protected current(): string {
		return this.pos < this.body.length ? this.body[this.pos] : '';
	}

	/**
	 * Peek ahead at a character without advancing position.
	 * @param offset Number of characters ahead to peek (default 1)
	 */
	protected peek(offset: number = 1): string {
		const idx = this.pos + offset;
		return idx < this.body.length ? this.body[idx] : '';
	}

	/**
	 * Get the previous character.
	 */
	protected previous(): string {
		return this.pos > 0 ? this.body[this.pos - 1] : '';
	}

	/**
	 * Advance position by one character.
	 */
	protected advance(): void {
		this.pos++;
	}

	/**
	 * Handle string literal delimiters (", ', `).
	 *
	 * Should be called when NOT in a comment context (caller's responsibility).
	 *
	 * @param ch Current character
	 * @param prev Previous character
	 * @returns true if a quote was processed (entering or exiting string mode)
	 */
	protected handleStringLiteral(ch: string, prev: string): boolean {
		if ((ch === '"' || ch === "'" || ch === '`') && prev !== '\\')
			if (!this.inString) {
				// Start of string - remember which quote type
				this.inString = true;
				this.stringChar = ch;
				return true;
			} else if (ch === this.stringChar) {
				// End of string - must match the opening quote
				this.inString = false;
				this.stringChar = '';
				return true;
			}
		return false;
	}

	/**
	 * Check if current position is at the end of input.
	 */
	protected isAtEnd(): boolean {
		return this.pos >= this.body.length;
	}
}
