<script lang="ts">
	type Props = {
		label: string;
		variant?: 'primary' | 'secondary';
	};

	const { label, variant = 'primary' }: Props = $props();
</script>

<button class={variant}>{label}</button>
