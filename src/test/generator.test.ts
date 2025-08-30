import * as assert from 'assert';
import { processSvelteDoc } from '../generator';

describe('generator (processSvelteDoc)', () => {
	it('inserts a new @component block with props and inherits', () => {
		const source = `<!-- existing header to be replaced -->\n<script lang="ts">\n\t// props type and usage\n\texport type ButtonProps = {\n\t\t/** primary color */\n\t\tcolor: string;\n\t\t/** optional size */\n\t\tsize?: number;\n\t};\n\tconst { color = $bindable('red'), size = 2 }: ButtonProps = $props();\n</script>\n<div/>`;
		const options = {
			propertyNameMatch: ['*Props'],
			addDescription: true,
			placeDescriptionBeforeProps: false
		};
		const result = processSvelteDoc(source, options);
		// Props header and bullets
		const mustContain = ['### Props', '`!$ color`', '`size`', '= `red`'];
		const missing = mustContain.filter((t) => !result.updated.includes(t));
		assert.deepStrictEqual(missing, [], 'Missing expected fragments: ' + missing.join(', '));
	});

	it('preserves existing description when updating', () => {
		const initial = `<!-- @component\nThis is my description.\n--><script lang="ts">\n\ttype XProps = { a: string };\n\tconst { a = 'x' }: XProps = $props();\n</script>`;
		const options = {
			propertyNameMatch: ['*Props'],
			addDescription: true,
			placeDescriptionBeforeProps: true
		};
		const out = processSvelteDoc(initial, options);
		assert.strictEqual(out.changed, true);
		assert.ok(out.updated.includes('This is my description.'));
	});

	it('skips when no TS <script> present', () => {
		const source = `<div>No script here</div>`;
		const options = {
			propertyNameMatch: ['*Props'],
			addDescription: false,
			placeDescriptionBeforeProps: false
		};
		const r = processSvelteDoc(source, options);
		assert.strictEqual(r.changed, false);
		assert.strictEqual(r.updated, source);
	});
});
