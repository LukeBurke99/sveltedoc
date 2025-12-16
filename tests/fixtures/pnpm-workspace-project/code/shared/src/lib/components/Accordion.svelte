<script lang="ts">
	import type { Snippet } from 'svelte';

	export interface AccordionContext {
		isOpen: boolean;
		toggle: () => void;
	}

	export type SomeOtherType = string | number;

	export function someFunction() {
		return 'test';
	}

	export function andAnotherFunction() {
		return 42;
	}

	interface Props {
		/** The title of the accordion header */
		title: string;
		/** Whether the accordion is initially open */
		open?: boolean;
		/** Content to render inside the accordion */
		children: Snippet;
	}

	let { title, open = false, children }: Props = $props();

	let isOpen = $state(open);

	function toggle() {
		isOpen = !isOpen;
	}
</script>

<div class="accordion">
	<button onclick={toggle}>
		{title}
	</button>
	{#if isOpen}
		<div class="content">
			{@render children()}
		</div>
	{/if}
</div>
