import * as assert from 'assert';
import { extractScriptBlocksFromText } from '../src/utils/extractor';

describe('Extractor: Script Blocks', () => {
	it('1. File without script tags', () => {
		const text = `
        <div>
            <h1>Hello World</h1>
            <p>This is a simple component with no script tags.</p>
        </div>
		`;

		const result = extractScriptBlocksFromText(text);

		assert.strictEqual(result.length, 0);
	});

	it('2. File with single script tag', () => {
		const text = `
        <script>
            let count = 0;
        </script>

        <div>
            <p>Count: {count}</p>
        </div>
		`;

		const result = extractScriptBlocksFromText(text);

		assert.strictEqual(result.length, 1);
		assert.ok(result[0].content.includes('let count = 0;'));
	});

	it('3. File with module and instance script tags', () => {
		const text = `
        <script context="module">
            export const moduleVar = 'module';
        </script>

        <script>
            let instanceVar = 'instance';
        </script>

        <div>
            <p>Content</p>
        </div>
		`;

		const result = extractScriptBlocksFromText(text);

		assert.strictEqual(result.length, 2);
		assert.ok(result[0].content.includes("export const moduleVar = 'module';"));
		assert.ok(result[1].content.includes("let instanceVar = 'instance';"));
	});

	it('4. File with commented out script block', () => {
		const text = `
        <!--
        <script>
            let count = 0;
        </script>

        <p>This whole section is commented out</p>
        -->
		`;

		const result = extractScriptBlocksFromText(text);

		assert.strictEqual(result.length, 0);
	});

	it('5. File with one commented and one active script block', () => {
		const text = `
        <!--
        <script>
            let commented = true;
        </script>
        -->

        <script>
            let active = true;
        </script>

        <p>Some content</p>
		`;

		const result = extractScriptBlocksFromText(text);

		assert.strictEqual(result.length, 1);
		assert.ok(result[0].content.includes('let active = true;'));
		assert.ok(!result[0].content.includes('let commented = true;'));
	});

	it('6. File with TypeScript and module attribute', () => {
		const text = `
        <script lang="ts" module>
            export const moduleVar = 'module';
        </script>

        <script lang="ts">
            let instanceVar = 'instance';
        </script>

        <div>
            <p>Content</p>
        </div>
		`;

		const result = extractScriptBlocksFromText(text);

		assert.strictEqual(result.length, 2);
		assert.ok(result[0].content.includes("export const moduleVar = 'module';"));
		assert.ok(result[1].content.includes("let instanceVar = 'instance';"));
	});
});
