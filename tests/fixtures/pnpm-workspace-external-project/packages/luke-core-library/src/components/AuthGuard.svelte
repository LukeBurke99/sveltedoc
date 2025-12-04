<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		/** Whether the user is authenticated */
		isAuthenticated: boolean;
		/** Redirect URL when not authenticated */
		redirectUrl?: string;
		/** Content to show when authenticated */
		children: Snippet;
	};

	const { isAuthenticated, redirectUrl = '/login', children }: Props = $props();
</script>

{#if isAuthenticated}
	{@render children()}
{:else}
	<p>Please <a href={redirectUrl}>login</a> to continue.</p>
{/if}
