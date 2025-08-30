import * as assert from 'assert';
import { fileMatchesPath, globToRegex } from '../match';

describe('path matching (match.ts)', () => {
	it('globToRegex: * matches within a single segment, ** across segments', () => {
		const single = new RegExp('^' + globToRegex('foo/*.svelte') + '$');
		assert.ok(single.test('foo/Bar.svelte'));
		assert.ok(single.test('foo/.svelte'));
		assert.ok(!single.test('foo/bar/baz.svelte'));

		const multi = new RegExp('^' + globToRegex('**/components/**/*.svelte') + '$');
		assert.ok(multi.test('src/components/Button.svelte'));
		assert.ok(multi.test('packages/ui/src/components/forms/Input.svelte'));
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
