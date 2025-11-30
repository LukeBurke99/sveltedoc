<script lang="ts">
	type Props = {
		label: string;
		disabled?: boolean;
	};

	const { label, disabled }: Props = $props();
</script>

<button {disabled}>
	{label}
</button>
