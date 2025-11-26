<script lang="ts">
	type Props = {
		title: string;
	};

	const { title }: Props = $props();
</script>

<div class="card">
	<h2>{title}</h2>
</div>
