import * as assert from 'assert';
import type { Position, TextDocument } from '../interfaces/vscode';
import { getTagNameAtPosition } from '../parsers/tagParser';

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

describe('Tag Parser: Get hovering tag name', () => {
	it('1. Should return tag name when hovering over opening tag', () => {
		const doc = createMockDocument('<Component prop="value">');
		const position = createPosition(1); // Position on 'C' in Component

		const result = getTagNameAtPosition(doc, position);

		assert.strictEqual(result, 'Component');
	});

	it('2. Should return FakeComponent when hovering over <FakeComponent', () => {
		const doc = createMockDocument();
		const position = createPosition(1, 32); // Line 32: <FakeComponent value={42} />

		const result = getTagNameAtPosition(doc, position);

		assert.strictEqual(result, 'FakeComponent');
	});

	it('3. Should return Complex when hovering over <Complex', () => {
		const doc = createMockDocument();
		const position = createPosition(1, 33); // Line 33: <Complex description="Some desc" items={[]} />

		const result = getTagNameAtPosition(doc, position);

		assert.strictEqual(result, 'Complex');
	});

	it('4. Should return Button when hovering over <Button', () => {
		const doc = createMockDocument();
		const position = createPosition(1, 35); // Line 35: <Button

		const result = getTagNameAtPosition(doc, position);

		assert.strictEqual(result, 'Button');
	});

	it('5. Should return FullScreenPopUp when hovering over <FullScreenPopUp', () => {
		const doc = createMockDocument();
		const position = createPosition(1, 96); // Line 96: <FullScreenPopUp bind:open={menuOpen}>

		const result = getTagNameAtPosition(doc, position);

		assert.strictEqual(result, 'FullScreenPopUp');
	});

	it('6. Should return undefined when hovering over <div>', () => {
		const doc = createMockDocument();
		const position = createPosition(5, 43); // Line 43: <div> (lowercase HTML element)

		const result = getTagNameAtPosition(doc, position);

		assert.strictEqual(result, undefined);
	});

	it('7. Should return undefined when hovering over Button in import statement', () => {
		const doc = createMockDocument();
		const position = createPosition(11, 2); // Line 2: import Button from...

		const result = getTagNameAtPosition(doc, position);

		assert.strictEqual(result, undefined);
	});

	it('8. Should return undefined when hovering over Object in {#each Object.entries', () => {
		const doc = createMockDocument();
		const position = createPosition(14, 42); // Line 42: {#each Object.entries

		const result = getTagNameAtPosition(doc, position);

		assert.strictEqual(result, undefined);
	});
});
