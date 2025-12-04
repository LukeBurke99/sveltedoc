/**
 * PropertyScanner: Character-by-character state machine for parsing TypeScript type/interface properties.
 *
 * This scanner handles the complex task of extracting property definitions from TypeScript
 * type/interface bodies, including:
 * - Multi-line properties without semicolons
 * - Nested types (objects, arrays, functions, generics)
 * - JSDoc comments
 * - String literals in types
 * - Inline comments within type definitions
 *
 * CRITICAL DESIGN PRINCIPLE - Context-Aware Character Processing:
 * ================================================================
 * Different contexts require different character handling rules:
 *
 * 1. COMMENT CONTEXTS (SINGLE_LINE_COMMENT, MULTI_LINE_COMMENT, JSDOC_COMMENT):
 *    - ALL characters are treated as plain text (no syntactic meaning)
 *    - Quotes (", ', `) do NOT start strings
 *    - Braces ({, }) do NOT affect depth tracking
 *    - Only the termination sequence ends the comment:
 *      * Single-line: newline (\n or \r)
 *      * Block/JSDoc: closing sequence (*\/)
 *    - This prevents bugs like treating code examples in JSDoc as real code
 *
 * 2. STRING LITERAL MODE (inString=true):
 *    - ALL characters are accumulated until the matching closing quote
 *    - Comment syntax (//, /*) is just text
 *    - Braces, brackets do NOT affect depth tracking
 *    - Only unescaped matching quote ends the string
 *
 * 3. CODE CONTEXTS (NONE, PROPERTY_NAME, AFTER_QUESTION, AFTER_COLON, PROPERTY_TYPE):
 *    - Characters have their normal syntactic meaning
 *    - Quotes start string literals
 *    - Braces/brackets affect depth tracking
 *    - Comment syntax starts comments
 *
 * The scanner uses a state machine with 8 contexts (see ScannerContext enum) to
 * ensure each character is processed correctly based on its surrounding context.
 */

import { ScannerContext, TypeEntry } from '../types';
import { BaseScanner } from './BaseScanner';

export class PropertyScanner extends BaseScanner {
	// Context tracking
	private context: ScannerContext = ScannerContext.NONE;

	// Current property being built
	private currentName: string = '';
	private currentOptional: boolean = false;

	// Results
	private properties: Map<string, TypeEntry> = new Map<string, TypeEntry>();
	private pendingJSDoc: string | undefined;

	// Buffers
	private buffer: string = '';

	// Normalization settings
	private shouldNormaliseComment: boolean;
	private shouldNormaliseType: boolean;

	public constructor(
		body: string,
		normaliseComment: boolean = false,
		normaliseType: boolean = true
	) {
		super(body);
		this.shouldNormaliseComment = normaliseComment;
		this.shouldNormaliseType = normaliseType;
	}

	public parse(): Partial<Record<string, TypeEntry>> {
		while (this.pos < this.body.length) this.scanCharacter();

		// Finalize any pending property
		this.finalizeProperty();

		return Object.fromEntries(this.properties);
	}

	/**
	 * Main character processing loop.
	 *
	 * CRITICAL: String literal and comment handling must be context-aware:
	 *
	 * 1. String literal processing is SKIPPED when in comment contexts because
	 *    comments can contain quotes that should NOT trigger string mode.
	 *    Example: /** mode="controlled" *\/ - the quotes are just text
	 *
	 * 2. When inString=true, we early-return to accumulate characters WITHOUT
	 *    processing them, EXCEPT when in comment contexts (which take precedence).
	 *
	 * 3. The switch statement delegates to context-specific handlers which ONLY
	 *    check for their specific termination conditions.
	 */
	private scanCharacter(): void {
		const ch = this.current();
		const next = this.peek();
		const prev = this.previous();

		// Determine if we're in a comment context
		// When in comments, quotes and other special chars are just text
		const inComment =
			this.context === ScannerContext.SINGLE_LINE_COMMENT ||
			this.context === ScannerContext.MULTI_LINE_COMMENT ||
			this.context === ScannerContext.JSDOC_COMMENT;

		// Handle string literals - BUT NOT in comments or AFTER_COLON
		// AFTER_COLON needs to transition to PROPERTY_TYPE first
		// Comments need to ignore quotes entirely (they're just text in comments)
		if (this.context !== ScannerContext.AFTER_COLON && !inComment)
			if (this.handleStringLiteral(ch, prev)) {
				this.advance();
				return;
			}

		// If we're inside a string literal, accumulate everything
		// EXCEPT when in a comment (comments take precedence over string mode)
		// This early return skips ALL other processing while inside strings
		if (this.inString && !inComment) {
			this.buffer += ch;
			this.advance();
			return;
		}

		// Delegate to context-specific handler
		// Each handler ONLY checks for its specific termination/transition conditions
		switch (this.context) {
			case ScannerContext.NONE:
				this.handleNoneContext(ch, next);
				break;
			case ScannerContext.SINGLE_LINE_COMMENT:
				this.handleSingleLineComment(ch);
				break;
			case ScannerContext.MULTI_LINE_COMMENT:
				this.handleMultiLineComment(ch, next);
				break;
			case ScannerContext.JSDOC_COMMENT:
				this.handleJSDocComment(ch, next);
				break;
			case ScannerContext.PROPERTY_NAME:
				this.handlePropertyName(ch, next);
				break;
			case ScannerContext.AFTER_QUESTION:
				this.handleAfterQuestion(ch);
				break;
			case ScannerContext.AFTER_COLON:
				this.handleAfterColon(ch);
				break;
			case ScannerContext.PROPERTY_TYPE:
				this.handlePropertyType(ch, next);
				break;
		}

		this.advance();
	}

	/**
	 * Override handleStringLiteral to also add to buffer.
	 */
	protected handleStringLiteral(ch: string, prev: string): boolean {
		const handled = super.handleStringLiteral(ch, prev);
		if (handled) this.buffer += ch;
		return handled;
	}

	/**
	 * NONE context: Looking for the start of a property or comment.
	 * Detects:
	 * - JSDoc comments: /**
	 * - Block comments: /*
	 * - Single-line comments: //
	 * - Property names: identifiers starting with A-Za-z_
	 */
	private handleNoneContext(ch: string, next: string): void {
		// Skip whitespace
		if (/\s/.test(ch)) return;

		// Check for comments
		if (ch === '/' && next === '*') {
			// Check if it's JSDoc (/** vs /*)
			if (this.peek(2) === '*') {
				this.context = ScannerContext.JSDOC_COMMENT;
				this.buffer = '';
				this.pos += 2; // Skip /**
			} else {
				this.context = ScannerContext.MULTI_LINE_COMMENT;
				this.pos++; // Skip /*
			}
			return;
		}

		if (ch === '/' && next === '/') {
			this.context = ScannerContext.SINGLE_LINE_COMMENT;
			this.pos++; // Skip //
			return;
		}

		// Check for property name start
		if (/[A-Za-z_]/.test(ch)) {
			this.context = ScannerContext.PROPERTY_NAME;
			this.buffer = ch;
			return;
		}
	}

	/**
	 * SINGLE_LINE_COMMENT context: Inside a // comment.
	 *
	 * CRITICAL: ALL characters are ignored until newline.
	 * This includes quotes, braces, etc. - they're all just comment text.
	 * Only \n or \r terminates the comment.
	 */
	private handleSingleLineComment(ch: string): void {
		if (ch === '\n' || ch === '\r') this.context = ScannerContext.NONE;
		// All other characters are ignored (not even accumulated)
	}

	/**
	 * MULTI_LINE_COMMENT context: Inside a /* *\/ block comment.
	 *
	 * CRITICAL: ALL characters are ignored until *\/.
	 * Quotes, braces, even nested /* sequences are just comment text.
	 * Only the *\/ sequence terminates the comment.
	 */
	private handleMultiLineComment(ch: string, next: string): void {
		if (ch === '*' && next === '/') {
			this.context = ScannerContext.NONE;
			this.pos++; // Skip */
		}
		// All other characters are ignored
	}

	/**
	 * JSDOC_COMMENT context: Inside a /** *\/ JSDoc comment.
	 *
	 * CRITICAL: ALL characters are accumulated as comment text until *\/.
	 * This is where the bug was: code examples in JSDoc like mode="controlled"
	 * were triggering string mode because quotes were being processed.
	 *
	 * NOW: Quotes, braces, slashes - ALL characters are just text until *\/.
	 * The caller ensures handleStringLiteral is never called in this context.
	 */
	private handleJSDocComment(ch: string, next: string): void {
		if (ch === '*' && next === '/') {
			// End of JSDoc - store it for the next property
			this.pendingJSDoc = this.normalizeComment(this.buffer);
			this.buffer = '';
			this.context = ScannerContext.NONE;
			this.pos++; // Skip */
		} else {
			// Accumulate ALL characters (they're all just comment text)
			this.buffer += ch;
		}
	}

	/**
	 * PROPERTY_NAME context: Reading a property identifier.
	 * Continues until we hit ?, :, or whitespace followed by :.
	 */
	private handlePropertyName(ch: string, next: string): void {
		// Valid identifier characters
		if (/[A-Za-z0-9_]/.test(ch)) {
			this.buffer += ch;
			return;
		}

		// Check for optional marker (?: syntax)
		if (ch === '?' && next === ':') {
			this.currentName = this.buffer.trim();
			this.currentOptional = true;
			this.buffer = '';
			this.context = ScannerContext.AFTER_QUESTION;
			return;
		}

		// Check for colon (required property)
		if (ch === ':') {
			this.currentName = this.buffer.trim();
			this.currentOptional = false;
			this.buffer = '';
			this.context = ScannerContext.AFTER_COLON;
			return;
		}

		// Whitespace before colon
		if (/\s/.test(ch)) return;

		// Invalid character - abort this property
		this.resetProperty();
		this.context = ScannerContext.NONE;
	}

	/**
	 * AFTER_QUESTION context: We've seen ?, expecting :.
	 */
	private handleAfterQuestion(ch: string): void {
		if (ch === ':') {
			this.context = ScannerContext.AFTER_COLON;
			return;
		}

		// Invalid - expected : after ?
		this.resetProperty();
		this.context = ScannerContext.NONE;
	}

	/**
	 * AFTER_COLON context: We've seen :, expecting type to start.
	 * Skips whitespace then transitions to PROPERTY_TYPE.
	 */
	private handleAfterColon(ch: string): void {
		// Skip whitespace after colon
		if (/\s/.test(ch)) return;

		// Start reading type
		this.context = ScannerContext.PROPERTY_TYPE;
		this.depth = 0;
		this.buffer = '';

		// Don't advance - let handlePropertyType process this character
		this.pos--;
	}

	/**
	 * PROPERTY_TYPE context: Reading the type annotation.
	 *
	 * This is the most complex handler as it must:
	 * - Track depth of nested structures ({}, [], ())
	 * - Detect property terminators at depth 0 (;, comments, new property)
	 * - Preserve inline comments at depth > 0
	 * - Handle the closing } of the type body
	 */
	private handlePropertyType(ch: string, next: string): void {
		// Track depth for nested structures
		// Depth is critical for knowing when we're at the top level vs inside a nested type
		if (ch === '{' || ch === '[' || ch === '(') {
			this.depth++;
			this.buffer += ch;
			return;
		}

		if (ch === '}' || ch === ']' || ch === ')') {
			this.depth--;
			this.buffer += ch;

			// Depth -1 means we've hit the closing } of the entire type/interface body
			if (this.depth < 0) {
				this.finalizeProperty();
				this.context = ScannerContext.NONE;
				this.pos--; // Don't consume the }, let caller handle it
				return;
			}
			return;
		}

		// At depth 0 (top level), check for property terminators
		if (this.depth === 0) {
			// Explicit semicolon terminates property
			if (ch === ';') {
				this.finalizeProperty();
				this.context = ScannerContext.NONE;
				return;
			}

			// JSDoc comment at depth 0 belongs to the NEXT property, not this one
			if (ch === '/' && next === '*' && this.peek(2) === '*') {
				this.finalizeProperty();
				this.context = ScannerContext.NONE;
				this.pos--; // Let main scanner handle the /**
				return;
			}

			// Block comment at depth 0 is a separator between properties
			if (ch === '/' && next === '*') {
				this.finalizeProperty();
				this.context = ScannerContext.NONE;
				this.pos--; // Let main scanner handle the /*
				return;
			}

			// Single-line comment at depth 0 is a separator
			if (ch === '/' && next === '/') {
				this.finalizeProperty();
				this.context = ScannerContext.NONE;
				this.pos--; // Let main scanner handle the //
				return;
			}

			// Check if we're hitting a new property (lookahead for identifier: pattern)
			if (/[A-Za-z_]/.test(ch))
				if (this.isNextPropertyStart()) {
					this.finalizeProperty();
					this.context = ScannerContext.NONE;
					this.pos--; // Let main scanner handle the property name
					return;
				}
		}

		// Handle comments INSIDE types (depth > 0)
		// These comments are part of the type and should be preserved
		if (this.depth > 0) {
			if (ch === '/' && next === '*') {
				// Block comment inside type - accumulate it
				this.buffer += ch;
				this.advance();
				this.buffer += this.current(); // Add the *
				// Continue until */
				while (this.pos < this.body.length) {
					this.advance();
					const c = this.current();
					this.buffer += c;
					if (c === '*' && this.peek() === '/') {
						this.advance();
						this.buffer += this.current(); // Add the /
						break;
					}
				}
				return;
			}

			if (ch === '/' && next === '/') {
				// Single-line comment inside type - accumulate it
				this.buffer += ch;
				this.advance();
				this.buffer += this.current(); // Add the second /
				// Continue until newline
				while (this.pos < this.body.length) {
					this.advance();
					const c = this.current();
					this.buffer += c;
					if (c === '\n' || c === '\r') break;
				}
				return;
			}
		}

		// Accumulate everything else
		this.buffer += ch;
	}

	/**
	 * Lookahead to determine if we're at the start of a new property.
	 * Checks for pattern: identifier followed by ?: or :
	 */
	private isNextPropertyStart(): boolean {
		let i = this.pos;
		let foundIdentifier = false;

		// Skip whitespace and check for union/intersection operators
		while (i < this.body.length) {
			const c = this.body[i];

			if (/\s/.test(c)) {
				i++;
				continue;
			}

			// Union/intersection are part of the current type, not a new property
			if (c === '|' || c === '&') return false;

			// Check for identifier start
			if (/[A-Za-z_]/.test(c)) {
				// Skip identifier characters
				while (i < this.body.length && /[A-Za-z0-9_]/.test(this.body[i])) i++;
				foundIdentifier = true;
				break;
			}

			// Any other character means not a property start
			return false;
		}

		if (!foundIdentifier) return false;

		// Skip whitespace after identifier
		while (i < this.body.length && /\s/.test(this.body[i])) i++;

		// Check for ?: or : (property declaration)
		if (i < this.body.length) {
			if (this.body[i] === ':') return true;
			if (this.body[i] === '?' && i + 1 < this.body.length && this.body[i + 1] === ':')
				return true;
		}

		return false;
	}

	/**
	 * Finalize the current property and add it to results.
	 * Normalizes whitespace in the type string for readability if shouldNormaliseType is true.
	 */
	private finalizeProperty(): void {
		if (!this.currentName) return;

		let type = this.buffer.trim();

		// Always dedent multi-line types to fix source indentation
		type = this.dedentType(type);

		if (this.shouldNormaliseType)
			// Normalize whitespace: collapse multiple spaces/newlines to single space,
			// then clean up spaces around brackets for readability
			type = type
				.replace(/\s+/g, ' ')
				.replace(/\(\s+/g, '(')
				.replace(/\s+\)/g, ')')
				.replace(/\{\s+/g, '{ ')
				.replace(/\s+\}/g, ' }')
				.replace(/\[\s+/g, '[')
				.replace(/\s+\]/g, ']')
				.replace(/<\s+/g, '<')
				.replace(/\s+>/g, '>');

		if (!type) {
			this.resetProperty();
			return;
		}

		this.properties.set(this.currentName, {
			name: this.currentName,
			type,
			required: !this.currentOptional,
			comment: this.pendingJSDoc
		});

		// Clear for next property
		this.resetProperty();
		this.pendingJSDoc = undefined; // JSDoc only applies to one property
	}

	/**
	 * Dedent a multi-line type string by removing common leading whitespace from all lines.
	 * This fixes indentation issues when extracting types from source files.
	 * @param type The type string to dedent
	 * @returns The dedented type string
	 */
	private dedentType(type: string): string {
		const lines = type.split('\n');

		// Single line - no dedenting needed
		if (lines.length === 1) return type;

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
		if (minIndent === Infinity || minIndent === 0) return type;

		// Remove the common indentation from all lines except the first
		const dedentedLines = lines.map((line, index) => {
			if (index === 0) return line; // First line has no leading indent to remove
			if (line.trim().length === 0) return ''; // Preserve empty lines as empty
			return line.slice(minIndent);
		});

		return dedentedLines.join('\n');
	}

	private resetProperty(): void {
		this.currentName = '';
		this.currentOptional = false;
		this.buffer = '';
	}

	/**
	 * Normalize JSDoc comment text by removing leading asterisks and whitespace.
	 * Only applies normalization if shouldNormaliseComment is true.
	 */
	private normalizeComment(raw: string): string {
		if (!this.shouldNormaliseComment)
			// When disabled: replace leading whitespace + asterisks with ' *' and preserve newlines
			return raw
				.split(/\r?\n/)
				.map((l) => l.replace(/^[ \t]+\*/, ' *'))
				.join('\n')
				.replace(/^[ \t]+|[ \t]+$/g, '');

		// When enabled: remove line-start asterisks (with leading whitespace) and collapse to single line
		return raw
			.split(/\r?\n/)
			.map((l) => l.replace(/^[ \t]*\*+\s?/, '').trim())
			.filter(Boolean)
			.join(' ')
			.trim();
	}
}
