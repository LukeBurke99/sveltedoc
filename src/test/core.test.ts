import * as assert from 'assert';
import {
	escapeRegExp,
	isQuote,
	scanToTopLevelSemicolon,
	splitOnce,
	splitTopLevel,
	wildcardToRegex
} from '../core';

describe('core helpers', () => {
	it('escapeRegExp escapes all regex metas', () => {
		const original = 'a+b*c?.^$()|[]{}\\';
		const escaped = escapeRegExp(original);
		// Using the escaped string as a regex should match the original literally
		const re = new RegExp(escaped);
		assert.ok(re.test(original));
		// Ensure "." is escaped (should not match 'abc' when pattern is 'a.c')
		const reDot = new RegExp(escapeRegExp('a.c'));
		assert.ok(!reDot.test('abc'));
	});

	it('isQuote identifies only quote characters', () => {
		assert.strictEqual(isQuote('"'), true);
		assert.strictEqual(isQuote("'"), true);
		assert.strictEqual(isQuote('`'), true);
		assert.strictEqual(isQuote('a' as any), false);
		assert.strictEqual(isQuote(' ' as any), false);
	});

	it('splitOnce splits only on the first delimiter', () => {
		assert.deepStrictEqual(splitOnce('a=b=c', '='), ['a', 'b=c']);
		assert.deepStrictEqual(splitOnce('abc', '='), ['abc', undefined]);
		assert.deepStrictEqual(splitOnce('key: value: more', ': '), ['key', 'value: more']);
	});

	it('splitTopLevel respects nesting and quotes', () => {
		const input = 'A<string, B<C>>, "x,y", D & E<F, G[]>'; // commas at top level should split into 3
		const parts = splitTopLevel(input, ',');
		assert.deepStrictEqual(
			parts.map((s) => s.trim()),
			['A<string, B<C>>', '"x,y"', 'D & E<F, G[]>']
		);

		const inter = 'X & { a: number, b: Array<[1,2]> } & Y<Z>';
		const interParts = splitTopLevel(inter, '&');
		assert.deepStrictEqual(
			interParts.map((s) => s.trim()),
			['X', '{ a: number, b: Array<[1,2]> }', 'Y<Z>']
		);
	});

	it('scanToTopLevelSemicolon finds the semicolon after a complex type alias', () => {
		const code = `\n// before\nexport type P = { a: string; b: Array<"x;y">; c: { nested: 1; } } /*comment*/ ;\nlet y = 1;`;
		const start = code.indexOf('=') + 1; // scan from after '='
		const idx = scanToTopLevelSemicolon(code, start);
		assert.ok(idx > start, 'should find a semicolon after the alias');
		assert.strictEqual(code[idx], ';');
		// Ensure it picked the top-level one (after the closing brace), not inside strings/comments
		const rhs = code.slice(start, idx).trim();
		assert.ok(rhs.startsWith('{') && rhs.endsWith('} /*comment*/'));
	});

	it('wildcardToRegex matches with * across any characters (including slashes)', () => {
		const re1 = wildcardToRegex('Foo*');
		assert.ok(re1.test('Foobar'));
		assert.ok(!re1.test('Bar'));

		const re2 = wildcardToRegex('A*B');
		assert.ok(re2.test('AB'));
		assert.ok(re2.test('A/something/B'));

		// Meta chars are escaped
		const re3 = wildcardToRegex('a.c');
		assert.ok(re3.test('a.c'));
		assert.ok(!re3.test('abc'));
	});
});
