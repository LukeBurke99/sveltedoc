<script lang="ts">
	type Props = {
		/** The input field label */
		label: string;
		/** Placeholder text */
		placeholder?: string;
		/** Whether the field is disabled */
		disabled?: boolean;
	};

	const { label, placeholder = '', disabled = false }: Props = $props();
</script>

<label>
	{label}
	<input type="text" {placeholder} {disabled} />
</label>
