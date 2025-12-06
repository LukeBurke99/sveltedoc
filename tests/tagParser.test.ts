import * as assert from 'assert';
import type { Position, TextDocument } from '../src/interfaces/vscode';
import { getTagNameAtPosition, TagDetectionOptions } from '../src/parsers/tagParser';

/** Options with hoverWithinTag disabled (legacy behavior) */
const DISABLED_OPTIONS: TagDetectionOptions = { hoverWithinTag: false, maxLines: 50 };

/** Options with hoverWithinTag enabled */
const ENABLED_OPTIONS: TagDetectionOptions = { hoverWithinTag: true, maxLines: 50 };

/**
 * Create a minimal mock TextDocument for testing tag parsing
 */
function createMockDocument(lineText?: string): TextDocument {
	lineText ??= `
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

    const pageStore = PageStore.get();

    //#region States

    let sortedTransactions: GroupedTransactions = $derived(
        groupTransactions(transactions),
    );
    let menuOpen = $state(false);

    //#endregion

    onMount(() => {
        pageStore.title = "Transactions";
    });
</script>

<FakeComponent value={42} />
<Complex description="Some desc" items={[]} />

<Button
    text="Filter"
    icon="mdi:filter-cog"
    class="ms-auto "
    onclick={() => (menuOpen = true)}
/>

{#each Object.entries(sortedTransactions) as [month, monthObj]}
    <div>
        <!-- Month Header -->
        <h2
            id="Month-{month.replaceAll(' ', '-')}"
            class="text-2xl gradient-bg py-2 pb-4 top-0 sticky flex items-center"
        >
            <span class="font-bold">{month}</span>
            <span class="text-xs ms-auto me-2 text-green-600"
                >({toCurrency(monthObj.in)})</span
            >
            <span class="text-xs text-red-600"
                >({toCurrency(monthObj.out)})</span
            >
        </h2>
        <!-- END of Month Header -->

        {#each Object.entries(monthObj.weeks) as [week, weekObj]}
            <div class="mb-4 last:mb-2">
                <!-- Week Header -->
                <h3 class="text-lg font-semibold text-gray-600 mb-3">
                    {week}
                </h3>
                <!-- END of Week Header -->

                <div
                    class="bg-white rounded-lg rounded-l-none shadow overflow-hidden"
                >
                    {#each weekObj.transactions as transaction, i}
                        {@const isLast = i === weekObj.transactions.length - 1}
                        <TransactionItem {transaction} />

                        <!-- Show the totals for the week at the end of the transactions -->
                        {#if isLast}
                            <div
                                class="flex text-sm items-center px-3 py-2 border-l-4 border-l-transparent"
                            >
                                <b class="flex-1">Totals</b>
                                <span class="text-green-500 pe-2"
                                    >{toCurrency(weekObj.in)}</span
                                >
                                <span class="text-red-500">
                                    {toCurrency(weekObj.out)}
                                </span>
                            </div>
                        {/if}
                        <!-- END of total for week -->
                    {/each}
                </div>
            </div>
        {/each}
    </div>
{/each}

<FullScreenPopUp bind:open={menuOpen}>
    <h3 class="text-2xl mb-4">Jump to month:</h3>
    <div class="flex flex-col gap-2">
        {#each Object.keys(sortedTransactions) as month}
            <a
                class="border border-zinc-700 p-2 rounded-lg"
                href="#Month-{month.replaceAll(' ', '-')}"
                onclick={() => (menuOpen = false)}>{month}</a
            >
        {/each}
    </div>
</FullScreenPopUp>

<style lang="postcss">
    .gradient-bg {
        @apply bg-gradient-to-b from-gray-100 to-transparent via-gray-100 via-65%;
    }
</style>
    `;
	return {
		getWordRangeAtPosition: (position: Position, regex?: RegExp) => {
			const lines = lineText.split('\n');
			const text = lines[position.line] || '';
			const pos = position.character;

			if (!regex) return undefined;

			// Find word boundaries around the position
			let start = pos;
			let end = pos;

			// Expand backwards
			while (start > 0 && regex.test(text[start - 1])) start--;

			// Expand forwards
			while (end < text.length && regex.test(text[end])) end++;

			if (start === end) return undefined;

			return {
				start: { character: start, line: position.line },
				end: { character: end, line: position.line }
			};
		},
		lineAt: (line: number) => {
			const lines = lineText.split('\n');
			return { text: lines[line] || '' };
		},
		getText: (range?: any) => {
			if (!range) return lineText;
			const lines = lineText.split('\n');
			const lineText2 = lines[range.start.line ?? 0] ?? '';
			return lineText2.slice(range.start.character, range.end.character);
		}
	};
}

function createPosition(character: number, line: number = 0): Position {
	return { character, line };
}

describe('Tag Parser: Get hovering tag name (hoverWithinTag: false)', () => {
	it('1. Should return tag name when hovering over opening tag', () => {
		const doc = createMockDocument('<Component prop="value">');
		const position = createPosition(1); // Position on 'C' in Component

		const result = getTagNameAtPosition(doc, position, DISABLED_OPTIONS);

		assert.strictEqual(result, 'Component');
	});

	it('2. Should return FakeComponent when hovering over <FakeComponent', () => {
		const doc = createMockDocument();
		const position = createPosition(1, 32); // Line 32: <FakeComponent value={42} />

		const result = getTagNameAtPosition(doc, position, DISABLED_OPTIONS);

		assert.strictEqual(result, 'FakeComponent');
	});

	it('3. Should return Complex when hovering over <Complex', () => {
		const doc = createMockDocument();
		const position = createPosition(1, 33); // Line 33: <Complex description="Some desc" items={[]} />

		const result = getTagNameAtPosition(doc, position, DISABLED_OPTIONS);

		assert.strictEqual(result, 'Complex');
	});

	it('4. Should return Button when hovering over <Button', () => {
		const doc = createMockDocument();
		const position = createPosition(1, 35); // Line 35: <Button

		const result = getTagNameAtPosition(doc, position, DISABLED_OPTIONS);

		assert.strictEqual(result, 'Button');
	});

	it('5. Should return FullScreenPopUp when hovering over <FullScreenPopUp', () => {
		const doc = createMockDocument();
		const position = createPosition(1, 96); // Line 96: <FullScreenPopUp bind:open={menuOpen}>

		const result = getTagNameAtPosition(doc, position, DISABLED_OPTIONS);

		assert.strictEqual(result, 'FullScreenPopUp');
	});

	it('6. Should return undefined when hovering over <div>', () => {
		const doc = createMockDocument();
		const position = createPosition(5, 43); // Line 43: <div> (lowercase HTML element)

		const result = getTagNameAtPosition(doc, position, DISABLED_OPTIONS);

		assert.strictEqual(result, undefined);
	});

	it('7. Should return undefined when hovering over Button in import statement', () => {
		const doc = createMockDocument();
		const position = createPosition(11, 2); // Line 2: import Button from...

		const result = getTagNameAtPosition(doc, position, DISABLED_OPTIONS);

		assert.strictEqual(result, undefined);
	});

	it('8. Should return undefined when hovering over Object in {#each Object.entries', () => {
		const doc = createMockDocument();
		const position = createPosition(14, 42); // Line 42: {#each Object.entries

		const result = getTagNameAtPosition(doc, position, DISABLED_OPTIONS);

		assert.strictEqual(result, undefined);
	});

	it('9. Should return undefined when hovering over attribute (hoverWithinTag disabled)', () => {
		const doc = createMockDocument('<Button color="red" />');
		const position = createPosition(10); // Position on 'color' attribute

		const result = getTagNameAtPosition(doc, position, DISABLED_OPTIONS);

		assert.strictEqual(result, undefined);
	});
});

describe('Tag Parser: Hover within tag (hoverWithinTag: true)', () => {
	// ==================== Single-line component tests ====================

	it('1. Should return Button when hovering over attribute name', () => {
		const doc = createMockDocument('<Button color="red" />');
		const position = createPosition(10); // Position on 'color'

		const result = getTagNameAtPosition(doc, position, ENABLED_OPTIONS);

		assert.strictEqual(result, 'Button');
	});

	it('2. Should return Button when hovering over attribute value', () => {
		const doc = createMockDocument('<Button color="red" />');
		const position = createPosition(16); // Position on 'red'

		const result = getTagNameAtPosition(doc, position, ENABLED_OPTIONS);

		assert.strictEqual(result, 'Button');
	});

	it('3. Should return Button when hovering on space before self-closing />', () => {
		const doc = createMockDocument('<Button color="red" />');
		const position = createPosition(20); // Position on space before />

		const result = getTagNameAtPosition(doc, position, ENABLED_OPTIONS);

		assert.strictEqual(result, 'Button');
	});

	it('4. Should return Component when hovering over expression in attribute', () => {
		const doc = createMockDocument('<Component value={someVar} />');
		const position = createPosition(18); // Position on 'someVar'

		const result = getTagNameAtPosition(doc, position, ENABLED_OPTIONS);

		assert.strictEqual(result, 'Component');
	});

	it('5. Should return Component when hovering over complex expression', () => {
		const doc = createMockDocument('<Component onclick={() => console.log("clicked")} />');
		const position = createPosition(25); // Position inside arrow function

		const result = getTagNameAtPosition(doc, position, ENABLED_OPTIONS);

		assert.strictEqual(result, 'Component');
	});

	// ==================== Multi-line component tests ====================

	it('6. Should return Button when hovering over attribute on second line', () => {
		const doc = createMockDocument(`<Button
    color="green"
    icon={successIcon}
/>`);
		const position = createPosition(10, 1); // Line 1, position on 'color'

		const result = getTagNameAtPosition(doc, position, ENABLED_OPTIONS);

		assert.strictEqual(result, 'Button');
	});

	it('7. Should return Button when hovering over attribute on third line', () => {
		const doc = createMockDocument(`<Button
    color="green"
    icon={successIcon}
/>`);
		const position = createPosition(10, 2); // Line 2, position on 'icon'

		const result = getTagNameAtPosition(doc, position, ENABLED_OPTIONS);

		assert.strictEqual(result, 'Button');
	});

	it('8. Should return Button when hovering inside complex multi-line onclick', () => {
		const doc = createMockDocument(`<Button
    color="green"
    onclick={(e: Event) => {
        console.log('Wow');
        doSomething();
    }}
>`);
		const position = createPosition(16, 3); // Line 3, inside console.log

		const result = getTagNameAtPosition(doc, position, ENABLED_OPTIONS);

		assert.strictEqual(result, 'Button');
	});

	it('9. Should return Button when hovering on closing brace of multi-line handler', () => {
		const doc = createMockDocument(`<Button
    onclick={() => {
        console.log('test');
    }}
/>`);
		const position = createPosition(5, 3); // Line 3, on the closing }}

		const result = getTagNameAtPosition(doc, position, ENABLED_OPTIONS);

		assert.strictEqual(result, 'Button');
	});

	// ==================== Negative tests ====================

	it('10. Should return undefined when hovering outside component tag', () => {
		const doc = createMockDocument('<Button /> <span>text</span>');
		const position = createPosition(15); // Position on 'span'

		const result = getTagNameAtPosition(doc, position, ENABLED_OPTIONS);

		assert.strictEqual(result, undefined);
	});

	it('11. Should return undefined when hovering in content between tags', () => {
		const doc = createMockDocument('<Button>Hello World</Button>');
		const position = createPosition(12); // Position on 'World'

		const result = getTagNameAtPosition(doc, position, ENABLED_OPTIONS);

		assert.strictEqual(result, undefined);
	});

	it('12. Should return undefined for lowercase html elements', () => {
		const doc = createMockDocument('<div class="test">');
		const position = createPosition(8); // Position on 'class'

		const result = getTagNameAtPosition(doc, position, ENABLED_OPTIONS);

		assert.strictEqual(result, undefined);
	});

	it('13. Should return Child (innermost) when hovering inside nested Child', () => {
		const doc = createMockDocument('<Parent><Child prop="value" /></Parent>');
		const position = createPosition(17); // Position on 'prop' inside Child

		const result = getTagNameAtPosition(doc, position, ENABLED_OPTIONS);

		assert.strictEqual(result, 'Child');
	});

	it('14. Should return undefined after self-closing tag ends', () => {
		const doc = createMockDocument('<Button /> some text');
		const position = createPosition(14); // Position on 'some'

		const result = getTagNameAtPosition(doc, position, ENABLED_OPTIONS);

		assert.strictEqual(result, undefined);
	});

	// ==================== Edge cases with strings containing special chars ====================

	it('15. Should handle strings with > inside attribute value', () => {
		const doc = createMockDocument('<Button label="Click > here" />');
		const position = createPosition(20); // Position on 'here' after >

		const result = getTagNameAtPosition(doc, position, ENABLED_OPTIONS);

		assert.strictEqual(result, 'Button');
	});

	it('16. Should handle strings with < inside attribute value', () => {
		const doc = createMockDocument('<Button label="a < b" />');
		const position = createPosition(18); // Position on 'b' after <

		const result = getTagNameAtPosition(doc, position, ENABLED_OPTIONS);

		assert.strictEqual(result, 'Button');
	});

	it('17. Should handle template literals with expressions', () => {
		const doc = createMockDocument('<Button label={`Value: ${count}`} />');
		const position = createPosition(26); // Position inside template literal

		const result = getTagNameAtPosition(doc, position, ENABLED_OPTIONS);

		assert.strictEqual(result, 'Button');
	});

	// ==================== Direct tag name still works ====================

	it('18. Should still return tag when hovering directly on tag name', () => {
		const doc = createMockDocument('<Button color="red" />');
		const position = createPosition(3); // Position on 'Button'

		const result = getTagNameAtPosition(doc, position, ENABLED_OPTIONS);

		assert.strictEqual(result, 'Button');
	});

	it('19. Should work with namespaced components like Foo.Bar', () => {
		const doc = createMockDocument('<Foo.Bar prop="value" />');
		const position = createPosition(12); // Position on 'prop'

		const result = getTagNameAtPosition(doc, position, ENABLED_OPTIONS);

		assert.strictEqual(result, 'Foo.Bar');
	});
});
