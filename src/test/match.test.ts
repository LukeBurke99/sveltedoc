import * as assert from 'assert';
import { fileMatchesPath, globToRegex } from '../match';

describe('path matching (match.ts)', () => {
	it('globToRegex: * matches within a single segment, ** across segments', () => {
		const pat = 'foo/*.svelte';
		const single = new RegExp('^' + globToRegex(pat) + '$');
		assert.ok(
			single.test('foo/Bar.svelte'),
			`pattern ${pat} should match foo/Bar.svelte; got ${single.toString()}`
		);
		assert.ok(
			single.test('foo/.svelte'),
			`pattern ${pat} should match foo/.svelte; got ${single.toString()}`
		);
		assert.ok(!single.test('foo/bar/baz.svelte'));

		const pat2 = '**/components/**/*.svelte';
		const multi = new RegExp('^' + globToRegex(pat2) + '$');
		assert.ok(
			multi.test('src/components/Button.svelte'),
			`pattern ${pat2} => ${multi.toString()} should match src/components/Button.svelte`
		);
		assert.ok(
			multi.test('packages/ui/src/components/forms/Input.svelte'),
			`pattern ${pat2} => ${multi.toString()} should match nested path`
		);
		assert.ok(!multi.test('src/containers/Button.ts'));
	});

	it('fileMatchesPath normalizes backslashes and tests multiple patterns', () => {
		const rel = 'src\\components\\Button.svelte';
		const patterns = ['**/components/**', 'lib/**'];
		assert.strictEqual(fileMatchesPath(rel, patterns), true);

		const rel2 = 'src/other/Thing.svelte';
		assert.strictEqual(fileMatchesPath(rel2, patterns), false);
	});
});
