<script lang="ts">
	type Props = {
		title: string;
		description?: string;
	};

	const { title, description }: Props = $props();
</script>

<div class="card">
	<h2>{title}</h2>
	{#if description}
		<p>{description}</p>
	{/if}
</div>
