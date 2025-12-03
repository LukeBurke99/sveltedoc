import * as assert from 'assert';
import {
	extractImportsFromScriptBlocks,
	extractScriptBlocksFromText
} from '../src/utils/extractor';

describe('Extractor: Import Statements', () => {
	it('1. No imports in script block', () => {
		const text = `
		<script>
			let count = 0;
			const increment = () => count++;
		</script>
		`;

		const blocks = extractScriptBlocksFromText(text);
		const result = extractImportsFromScriptBlocks(blocks);

		assert.strictEqual(result.size, 0);
	});

	it('2. Single default import with double quotes', () => {
		const text = `
		<script>
			import Button from "./components/Button.svelte";
			let count = 0;
		</script>
		`;

		const blocks = extractScriptBlocksFromText(text);
		const result = extractImportsFromScriptBlocks(blocks);

		assert.strictEqual(result.size, 1);
		assert.strictEqual(result.get('Button')?.specifier, './components/Button.svelte');
	});

	it('3. Single default import with single quotes', () => {
		const text = `
		<script>
			import Header from './components/Header.svelte';
		</script>
		`;

		const blocks = extractScriptBlocksFromText(text);
		const result = extractImportsFromScriptBlocks(blocks);

		assert.strictEqual(result.size, 1);
		assert.strictEqual(result.get('Header')?.specifier, './components/Header.svelte');
	});

	it('4. Multiple imports from different files', () => {
		const text = `
		<script>
			import Button from "./components/Button.svelte";
			import Header from './components/Header.svelte';
			import Footer from "../Footer.svelte";
		</script>
		`;

		const blocks = extractScriptBlocksFromText(text);
		const result = extractImportsFromScriptBlocks(blocks);

		assert.strictEqual(result.size, 3);
		assert.strictEqual(result.get('Button')?.specifier, './components/Button.svelte');
		assert.strictEqual(result.get('Header')?.specifier, './components/Header.svelte');
		assert.strictEqual(result.get('Footer')?.specifier, '../Footer.svelte');
	});

	it('5. Import with semicolon and without semicolon', () => {
		const text = `
		<script>
			import Component1 from "./Component1.svelte";
			import Component2 from "./Component2.svelte"
		</script>
		`;

		const blocks = extractScriptBlocksFromText(text);
		const result = extractImportsFromScriptBlocks(blocks);

		assert.strictEqual(result.size, 2);
		assert.strictEqual(result.get('Component1')?.specifier, './Component1.svelte');
		assert.strictEqual(result.get('Component2')?.specifier, './Component2.svelte');
	});

	it('6. Import from package (node_modules)', () => {
		const text = `
		<script>
			import Button from "$lib/components/Button.svelte";
			import Icon from "@iconify/svelte";
		</script>
		`;

		const blocks = extractScriptBlocksFromText(text);
		const result = extractImportsFromScriptBlocks(blocks);

		assert.strictEqual(result.size, 2);
		assert.strictEqual(result.get('Button')?.specifier, '$lib/components/Button.svelte');
		assert.strictEqual(result.get('Icon')?.specifier, '@iconify/svelte');
	});

	it('7. Imports from multiple script blocks', () => {
		const text = `
		<script context="module">
			import ModuleComponent from "./ModuleComponent.svelte";
		</script>

		<script>
			import InstanceComponent from "./InstanceComponent.svelte";
		</script>
		`;

		const blocks = extractScriptBlocksFromText(text);
		const result = extractImportsFromScriptBlocks(blocks);

		assert.strictEqual(result.size, 2);
		assert.strictEqual(result.get('ModuleComponent')?.specifier, './ModuleComponent.svelte');
		assert.strictEqual(
			result.get('InstanceComponent')?.specifier,
			'./InstanceComponent.svelte'
		);
	});

	it('8. Import with varied whitespace', () => {
		const text = `
		<script>
			import   Component1   from   "./Component1.svelte"  ;
			import Component2 from "./Component2.svelte";
			import	Component3	from	"./Component3.svelte";
		</script>
		`;

		const blocks = extractScriptBlocksFromText(text);
		const result = extractImportsFromScriptBlocks(blocks);

		assert.strictEqual(result.size, 3);
		assert.strictEqual(result.get('Component1')?.specifier, './Component1.svelte');
		assert.strictEqual(result.get('Component2')?.specifier, './Component2.svelte');
		assert.strictEqual(result.get('Component3')?.specifier, './Component3.svelte');
	});

	it('9. Import with underscores and numbers in name', () => {
		const text = `
		<script>
			import Button_2 from "./Button_2.svelte";
			import MyComponent123 from "./MyComponent123.svelte";
			import _PrivateComponent from "./_PrivateComponent.svelte";
		</script>
		`;

		const blocks = extractScriptBlocksFromText(text);
		const result = extractImportsFromScriptBlocks(blocks);

		assert.strictEqual(result.size, 3);
		assert.strictEqual(result.get('Button_2')?.specifier, './Button_2.svelte');
		assert.strictEqual(result.get('MyComponent123')?.specifier, './MyComponent123.svelte');
		assert.strictEqual(
			result.get('_PrivateComponent')?.specifier,
			'./_PrivateComponent.svelte'
		);
	});

	it('10. Should capture named imports', () => {
		const text = `
		<script>
			import { namedExport } from "./utils.js";
			import DefaultExport from "./Component.svelte";
			import { a, b, c } from "./multiple.js";
		</script>
		`;

		const blocks = extractScriptBlocksFromText(text);
		const result = extractImportsFromScriptBlocks(blocks);

		// Both default and named imports should be captured
		assert.strictEqual(result.size, 5);
		assert.strictEqual(result.get('DefaultExport')?.specifier, './Component.svelte');
		assert.strictEqual(result.get('namedExport')?.specifier, './utils.js');
		assert.strictEqual(result.get('a')?.specifier, './multiple.js');
		assert.strictEqual(result.get('b')?.specifier, './multiple.js');
		assert.strictEqual(result.get('c')?.specifier, './multiple.js');
	});

	it('11. Import with file extensions (.ts, .js, .svelte)', () => {
		const text = `
		<script>
			import Component from "./Component.svelte";
			import utils from "./utils.ts";
			import helpers from "./helpers.js";
		</script>
		`;

		const blocks = extractScriptBlocksFromText(text);
		const result = extractImportsFromScriptBlocks(blocks);

		assert.strictEqual(result.size, 3);
		assert.strictEqual(result.get('Component')?.specifier, './Component.svelte');
		assert.strictEqual(result.get('utils')?.specifier, './utils.ts');
		assert.strictEqual(result.get('helpers')?.specifier, './helpers.js');
	});

	it('12. Duplicate import names (last one wins)', () => {
		const text = `
		<script>
			import Button from "./Button1.svelte";
			import Button from "./Button2.svelte";
		</script>
		`;

		const blocks = extractScriptBlocksFromText(text);
		const result = extractImportsFromScriptBlocks(blocks);

		assert.strictEqual(result.size, 1);
		// Map keeps the last value set
		assert.strictEqual(result.get('Button')?.specifier, './Button2.svelte');
	});

	it('13. Complex real-world example', () => {
		const text = `
		<script lang="ts">
			import Button from "$lib/components/buttons/Button.svelte";
			import FullScreenPopUp from "$lib/components/popups/FullScreenPopUp.svelte";
			import TransactionItem from "$lib/components/transaction/TransactionItem.svelte";
			import { transactions } from "$lib/data/transactions";
			import { PageStore } from "$lib/stores/pageStore.svelte";
			import { toCurrency } from "$lib/utils/currencyUtils";
			import {
				groupTransactions,
				type GroupedTransactions,
			} from "$lib/utils/transactionUtils";
			import { onMount } from "svelte";
			import Complex from './Complex.svelte';
			import FakeComponent from './FakeComponent.svelte';
		</script>
		`;

		const blocks = extractScriptBlocksFromText(text);
		const result = extractImportsFromScriptBlocks(blocks);

		// Both default and named imports should be captured
		// Default imports: Button, FullScreenPopUp, TransactionItem, Complex, FakeComponent (5)
		// Named imports: transactions, PageStore, toCurrency, groupTransactions, onMount (5)
		// Note: 'type GroupedTransactions' is skipped as it's a type import
		assert.strictEqual(result.size, 10);
		assert.strictEqual(
			result.get('Button')?.specifier,
			'$lib/components/buttons/Button.svelte'
		);
		assert.strictEqual(
			result.get('FullScreenPopUp')?.specifier,
			'$lib/components/popups/FullScreenPopUp.svelte'
		);
		assert.strictEqual(
			result.get('TransactionItem')?.specifier,
			'$lib/components/transaction/TransactionItem.svelte'
		);
		assert.strictEqual(result.get('Complex')?.specifier, './Complex.svelte');
		assert.strictEqual(result.get('FakeComponent')?.specifier, './FakeComponent.svelte');
		// Named imports are now captured
		assert.strictEqual(result.get('transactions')?.specifier, '$lib/data/transactions');
		assert.strictEqual(result.get('PageStore')?.specifier, '$lib/stores/pageStore.svelte');
		assert.strictEqual(result.get('toCurrency')?.specifier, '$lib/utils/currencyUtils');
		assert.strictEqual(
			result.get('groupTransactions')?.specifier,
			'$lib/utils/transactionUtils'
		);
		assert.strictEqual(result.get('onMount')?.specifier, 'svelte');
		// Type imports are skipped
		assert.strictEqual(result.get('GroupedTransactions'), undefined);
	});

	it('14. Named imports with aliases', () => {
		const text = `
		<script>
			import { Component as MyComp } from "./Component.svelte";
			import { foo as bar, baz } from "./utils.js";
		</script>
		`;

		const blocks = extractScriptBlocksFromText(text);
		const result = extractImportsFromScriptBlocks(blocks);

		// Should use the alias names
		assert.strictEqual(result.size, 3);
		assert.strictEqual(result.get('MyComp')?.specifier, './Component.svelte');
		assert.strictEqual(result.get('MyComp')?.originalName, 'Component');
		assert.strictEqual(result.get('bar')?.specifier, './utils.js');
		assert.strictEqual(result.get('bar')?.originalName, 'foo');
		assert.strictEqual(result.get('baz')?.specifier, './utils.js');
		assert.strictEqual(result.get('baz')?.originalName, undefined);
		// Original names should not be in the map as keys
		assert.strictEqual(result.get('Component'), undefined);
		assert.strictEqual(result.get('foo'), undefined);
	});

	it('15. Mixed default and named imports from same module', () => {
		const text = `
		<script>
			import DefaultExport, { named1, named2 } from "./module.js";
		</script>
		`;

		const blocks = extractScriptBlocksFromText(text);
		const result = extractImportsFromScriptBlocks(blocks);

		// Mixed imports are now supported - all 3 should be captured
		assert.strictEqual(result.size, 3);
		assert.strictEqual(result.get('DefaultExport')?.specifier, './module.js');
		assert.strictEqual(result.get('named1')?.specifier, './module.js');
		assert.strictEqual(result.get('named2')?.specifier, './module.js');
	});

	it('16. Type imports should be skipped', () => {
		const text = `
		<script lang="ts">
			import type { TypeOnly } from "./types";
			import { type InlineType, actualValue } from "./mixed";
			import { regularImport } from "./regular";
		</script>
		`;

		const blocks = extractScriptBlocksFromText(text);
		const result = extractImportsFromScriptBlocks(blocks);

		// Only non-type imports should be captured
		assert.strictEqual(result.size, 2);
		assert.strictEqual(result.get('actualValue')?.specifier, './mixed');
		assert.strictEqual(result.get('regularImport')?.specifier, './regular');
		assert.strictEqual(result.get('TypeOnly'), undefined);
		assert.strictEqual(result.get('InlineType'), undefined);
	});

	it('17. Named imports with various whitespace', () => {
		const text = `
		<script>
			import {a,b,c} from "./compact.js";
			import { d , e , f } from "./spaced.js";
			import {
				multiline1,
				multiline2
			} from "./multiline.js";
		</script>
		`;

		const blocks = extractScriptBlocksFromText(text);
		const result = extractImportsFromScriptBlocks(blocks);

		// Compact and spaced should work fine (6 imports)
		assert.strictEqual(result.get('a')?.specifier, './compact.js');
		assert.strictEqual(result.get('b')?.specifier, './compact.js');
		assert.strictEqual(result.get('c')?.specifier, './compact.js');
		assert.strictEqual(result.get('d')?.specifier, './spaced.js');
		assert.strictEqual(result.get('e')?.specifier, './spaced.js');
		assert.strictEqual(result.get('f')?.specifier, './spaced.js');

		// Multiline imports should also work
		assert.strictEqual(result.get('multiline1')?.specifier, './multiline.js');
		assert.strictEqual(result.get('multiline2')?.specifier, './multiline.js');

		// Total should be 8 named imports
		assert.strictEqual(result.size, 8);
	});

	it('18. Multiple script blocks (module and instance context)', () => {
		const text = `
		<script context="module">
			import { moduleStore } from "./stores/module.js";
			import ModuleComponent from "./ModuleComponent.svelte";
			import { helper1, helper2 } from "./utils/helpers";
		</script>

		<script>
			import Button from "./Button.svelte";
			import { writable } from "svelte/store";
			import { onMount } from "svelte";
			import InstanceComp, { namedExport } from "./mixed.js";
		</script>
		`;

		const blocks = extractScriptBlocksFromText(text);
		const result = extractImportsFromScriptBlocks(blocks);

		// Module context imports (4 total)
		assert.strictEqual(result.get('moduleStore')?.specifier, './stores/module.js');
		assert.strictEqual(result.get('ModuleComponent')?.specifier, './ModuleComponent.svelte');
		assert.strictEqual(result.get('helper1')?.specifier, './utils/helpers');
		assert.strictEqual(result.get('helper2')?.specifier, './utils/helpers');

		// Instance context imports (5 total)
		assert.strictEqual(result.get('Button')?.specifier, './Button.svelte');
		assert.strictEqual(result.get('writable')?.specifier, 'svelte/store');
		assert.strictEqual(result.get('onMount')?.specifier, 'svelte');
		assert.strictEqual(result.get('InstanceComp')?.specifier, './mixed.js');
		assert.strictEqual(result.get('namedExport')?.specifier, './mixed.js');

		// Total should be 9 imports across both script blocks
		assert.strictEqual(result.size, 9);
	});

	it('19. Named imports with aliases preserve original name for barrel resolution', () => {
		const text = `
		<script>
			import { Button, Card as CoreCard, FakeButton } from '@budget-suite/shared';
		</script>
		`;

		const blocks = extractScriptBlocksFromText(text);
		const result = extractImportsFromScriptBlocks(blocks);

		// All three should be captured
		assert.strictEqual(result.size, 3);

		// Button - no alias, originalName should be undefined
		const buttonInfo = result.get('Button');
		assert.ok(buttonInfo, 'Button should be in map');
		assert.strictEqual(buttonInfo.specifier, '@budget-suite/shared');
		assert.strictEqual(buttonInfo.originalName, undefined);

		// CoreCard - alias for Card, originalName should be 'Card'
		const coreCardInfo = result.get('CoreCard');
		assert.ok(coreCardInfo, 'CoreCard should be in map');
		assert.strictEqual(coreCardInfo.specifier, '@budget-suite/shared');
		assert.strictEqual(coreCardInfo.originalName, 'Card');

		// FakeButton - no alias, originalName should be undefined
		const fakeButtonInfo = result.get('FakeButton');
		assert.ok(fakeButtonInfo, 'FakeButton should be in map');
		assert.strictEqual(fakeButtonInfo.specifier, '@budget-suite/shared');
		assert.strictEqual(fakeButtonInfo.originalName, undefined);
	});
});
