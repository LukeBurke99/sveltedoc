<script lang="ts">
	interface Props {
		/** The label for the input */
		label: string;
		/** The input value */
		value?: string;
		/** Placeholder text */
		placeholder?: string;
	}

	let { label, value = '', placeholder = '' }: Props = $props();
</script>

<div class="input-wrapper">
	<label>{label}</label>
	<input type="text" bind:value placeholder={placeholder} />
</div>
