/**
 * DestructuringScanner: Character-by-character scanner for parsing $props() destructuring patterns.
 *
 * Extracts property names and default values from destructuring patterns like:
 * const { id = 'default', count = $bindable(10), ...rest } = $props();
 *
 * Handles:
 * - Complex default values with nested braces: (event) => { console.log(event); }
 * - String literals in default values
 * - Spread patterns (...rest) - ignored
 * - Property aliases ({ name: localName }) - only external name exposed
 */

import { BaseScanner } from './BaseScanner';

export type DestructuredItem = {
	name: string; // External prop name (exposed on component)
	defaultValue?: string; // Raw default value string (preserved as-is)
};

export class DestructuringScanner extends BaseScanner {
	private items: DestructuredItem[] = [];

	// Current item being built
	private currentName: string = '';
	private currentValue: string = '';
	private parsingValue: boolean = false;

	// Depth tracking for nested structures in default values
	private parenDepth: number = 0;
	private bracketDepth: number = 0;
	private braceDepth: number = 0;

	// Normalization setting
	private shouldNormaliseDefaultValue: boolean;

	public constructor(content: string, normaliseDefaultValue: boolean = true) {
		super(content);
		this.shouldNormaliseDefaultValue = normaliseDefaultValue;
	}

	public scan(): DestructuredItem[] {
		while (!this.isAtEnd()) this.scanCharacter();

		// Finalize any pending item
		this.finalizeItem();

		return this.items;
	}

	private scanCharacter(): void {
		const ch = this.current();
		const prev = this.previous();

		// Handle string literals (quotes don't trigger other parsing when inside strings)
		if (this.handleStringLiteral(ch, prev)) {
			if (this.parsingValue) this.currentValue += ch;
			this.advance();
			return;
		}

		// If we're inside a string literal, accumulate to value
		if (this.inString) {
			if (this.parsingValue) this.currentValue += ch;
			this.advance();
			return;
		}

		// Track depth of nested structures when parsing default values
		if (this.parsingValue)
			if (ch === '(') this.parenDepth++;
			else if (ch === ')') this.parenDepth--;
			else if (ch === '[') this.bracketDepth++;
			else if (ch === ']') this.bracketDepth--;
			else if (ch === '{') this.braceDepth++;
			else if (ch === '}') this.braceDepth--;

		// Main parsing logic
		if (ch === ',' && this.isAtTopLevel()) {
			// Comma at top level - end of current item
			this.finalizeItem();
			this.advance();
			return;
		}

		if (ch === '=' && !this.parsingValue && this.currentName) {
			// Start of default value
			this.parsingValue = true;
			this.advance();
			return;
		}

		if (ch === ':' && !this.parsingValue && this.currentName) {
			// Property alias: { name: localName }
			// We only care about the external name (already captured)
			// Skip until we find = or ,
			this.skipAlias();
			return;
		}

		// Skip whitespace when not parsing value
		if (!this.parsingValue && /\s/.test(ch)) {
			this.advance();
			return;
		}

		// Build up current name or value
		if (this.parsingValue) {
			// Accumulate default value (preserve all characters including whitespace)
			this.currentValue += ch;
		} else {
			// Accumulate property name
			// Check for spread pattern
			if (ch === '.' && this.peek() === '.' && this.peek(2) === '.') {
				// Skip spread pattern (...rest)
				this.skipSpread();
				return;
			}

			// Regular property name character
			if (/[a-zA-Z_$0-9]/.test(ch)) this.currentName += ch;
		}

		this.advance();
	}

	/**
	 * Check if we're at the top level (all depths are 0).
	 */
	private isAtTopLevel(): boolean {
		return this.parenDepth === 0 && this.bracketDepth === 0 && this.braceDepth === 0;
	}

	/**
	 * Skip property alias (: localName part).
	 * We only expose the external name, so skip until = or ,
	 */
	private skipAlias(): void {
		this.advance(); // Skip the ':'

		// Skip whitespace
		while (!this.isAtEnd() && /\s/.test(this.current())) this.advance();

		// Skip the local name
		while (!this.isAtEnd()) {
			const ch = this.current();
			if (ch === '=' || ch === ',') {
				// If we hit =, we have a default value coming
				if (ch === '=') {
					this.parsingValue = true;
					this.advance();
				}
				return;
			}
			this.advance();
		}
	}

	/**
	 * Skip spread pattern (...rest).
	 */
	private skipSpread(): void {
		// Skip the three dots
		this.advance(); // First dot
		this.advance(); // Second dot
		this.advance(); // Third dot

		// Skip the rest identifier
		while (!this.isAtEnd()) {
			const ch = this.current();
			if (ch === ',' || ch === '}') return;
			this.advance();
		}
	}

	/**
	 * Finalize the current item and add to results.
	 */
	private finalizeItem(): void {
		const name = this.currentName.trim();
		if (!name) {
			this.resetItem();
			return;
		}

		let defaultValue = this.currentValue.trim() || undefined;

		// Always dedent multi-line values to fix source indentation
		if (defaultValue) defaultValue = this.dedentValue(defaultValue);

		// Apply normalization if enabled (collapse all whitespace to single spaces)
		if (defaultValue && this.shouldNormaliseDefaultValue)
			defaultValue = defaultValue.replace(/\s+/g, ' ');

		const item: DestructuredItem = {
			name,
			defaultValue
		};

		this.items.push(item);
		this.resetItem();
	}

	/**
	 * Dedent a multi-line string by removing common leading whitespace from all lines.
	 * This fixes indentation issues when extracting values from source files.
	 * @param value The string to dedent
	 * @returns The dedented string
	 */
	private dedentValue(value: string): string {
		const lines = value.split('\n');

		// Single line - no dedenting needed
		if (lines.length === 1) return value;

		// Find minimum indentation across non-empty lines (excluding first line)
		const leadingWhitespaceRe = /^(\s*)/;
		let minIndent = Infinity;
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i];
			if (line.trim().length === 0) continue; // Skip empty lines

			const match = leadingWhitespaceRe.exec(line);
			if (match) minIndent = Math.min(minIndent, match[1].length);
		}

		// If no indentation found, return as-is
		if (minIndent === Infinity || minIndent === 0) return value;

		// Remove the common indentation from all lines except the first
		const dedentedLines = lines.map((line, index) => {
			if (index === 0) return line; // First line has no leading indent to remove
			if (line.trim().length === 0) return ''; // Preserve empty lines as empty
			return line.slice(minIndent);
		});

		return dedentedLines.join('\n');
	}

	/**
	 * Reset state for next item.
	 */
	private resetItem(): void {
		this.currentName = '';
		this.currentValue = '';
		this.parsingValue = false;
		this.parenDepth = 0;
		this.bracketDepth = 0;
		this.braceDepth = 0;
	}
}
