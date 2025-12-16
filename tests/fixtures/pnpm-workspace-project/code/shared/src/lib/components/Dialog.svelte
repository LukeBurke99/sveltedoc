<script lang="ts">
	import type { Snippet } from 'svelte';

	export interface ModalContext {
		isVisible: boolean;
		show: () => void;
		hide: () => void;
	}

	interface Props {
		/** The title of the modal */
		title: string;
		/** Whether the modal is initially visible */
		visible?: boolean;
		/** Content to render inside the modal */
		children: Snippet;
	}

	let { title, visible = false, children }: Props = $props();

	let isVisible = $state(visible);

	export function show() {
		isVisible = true;
	}

	export function hide() {
		isVisible = false;
	}
</script>

<div class="modal" class:visible={isVisible}>
	<div class="modal-header">
		<h2>{title}</h2>
		<button onclick={hide}>×</button>
	</div>
	<div class="modal-content">
		{@render children()}
	</div>
</div>
