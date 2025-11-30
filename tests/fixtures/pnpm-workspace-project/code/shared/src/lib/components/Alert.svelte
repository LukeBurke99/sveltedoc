<script lang="ts">
	interface Props {
		/** Alert message to display */
		message: string;
		/** Alert type (info, warning, error) */
		type?: 'info' | 'warning' | 'error';
		/** Whether the alert is dismissible */
		dismissible?: boolean;
	}

	const { message, type = 'info', dismissible = false }: Props = $props();
</script>

<div class="alert alert-{type}">
	<p>{message}</p>
	{#if dismissible}
		<button>×</button>
	{/if}
</div>
