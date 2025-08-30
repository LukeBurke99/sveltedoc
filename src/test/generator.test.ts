import * as assert from 'assert';
import { processSvelteDoc } from '../generator';
import { ProcessOptions } from '../types';

//#region Constants (component mockups)

const FULL_COMPONENT_WITH_TYPE = `<script lang="ts">
	import type { TooltipSide } from '@/lib/types/enums';
	import type { Component, Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	export type ButtonProps = HTMLButtonAttributes & Pick<HTMLAttributes<HTMLDivElement>, 'title'> & Omit<SomeRandomProps, 'b'> & {
		/** The color of the button (tailwind color class) */
		color?: 'primary' | 'danger' | (string & {});
		/** the HTML button element. */
		element?: HTMLButtonElement;
		/** whether the button is currently running a task and is 'loading' */
		loading: boolean;
		/** Padding for the button. */
		padding?: string;
		/** The icon to display in the button. */
		icon?: Component;
		/** The classes to apply to the icon. */
		iconClass: string;
		/** The position of the tooltip. */
		tooltipPosition?: TooltipSide;
		/** Delay before showing the tooltip. */
		tooltipDelay?: number;
		/** A callback function for when the button is clicked. */
		onClick?: (event?: MouseEvent) => void;
		/** The content to display inside the button. Passes in 'loading' variable */
		extraContent?: Snippet<[boolean]>;
	};
	let {
		color,
		element = $bindable(),
		loading = $bindable(false),
		icon: IconComponent,
		iconClass,
		type = 'button',
		title,
		children,
		tooltipPosition,
		tooltipDelay = 500,
		padding = 'px-4 pt-2 pb-2.5',
		...rest
	}: ButtonProps = $props();
</script>`;

const FULL_COMPONENT_WITH_INTERFACE = `<script lang="ts">
	import type { TooltipSide } from '@/lib/types/enums';
	import type { Component, Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface ButtonProps extends HTMLButtonAttributes, Pick<HTMLAttributes<HTMLDivElement>, 'title'>, Omit<SomeRandomProps, 'b'> {
		/** The color of the button (tailwind color class) */
		color?: 'primary' | 'danger' | (string & {});
		/** the HTML button element. */
		element?: HTMLButtonElement;
		/** whether the button is currently running a task and is 'loading' */
		loading: boolean;
		/** Padding for the button. */
		padding?: string;
		/** The icon to display in the button. */
		icon?: Component;
		/** The classes to apply to the icon. */
		iconClass: string;
		/** The position of the tooltip. */
		tooltipPosition?: TooltipSide;
		/** Delay before showing the tooltip. */
		tooltipDelay?: number;
		/** A callback function for when the button is clicked. */
		onClick?: (event?: MouseEvent) => void;
		/** The content to display inside the button. Passes in 'loading' variable */
		extraContent?: Snippet<[boolean]>;
	};
	let {
		color,
		element = $bindable(),
		loading = $bindable(false),
		icon: IconComponent,
		iconClass,
		type = 'button',
		title,
		children,
		tooltipPosition,
		tooltipDelay = 500,
		padding = 'px-4 pt-2 pb-2.5',
		...rest
	}: ButtonProps = $props();
</script>`;

//#endregion

describe('generator (processSvelteDoc)', () => {
	// Checks that the expected response it given when saving a new component
	it('inserts a new @component block with props and inherits (type and interface)', () => {
		const options: ProcessOptions = {
			propertyNameMatch: ['*Props'],
			addDescription: true,
			placeDescriptionBeforeProps: false
		};
		const typeResult = processSvelteDoc(FULL_COMPONENT_WITH_TYPE, options);
		const interfaceResult = processSvelteDoc(FULL_COMPONENT_WITH_INTERFACE, options);

		// Props header and bullets
		const mustContain = [
			'<!-- @component',
			'### Props',
			"#### Inherits: `HTMLButtonAttributes` & `Pick◄HTMLAttributes◄HTMLDivElement►, 'title'►` & `Omit◄SomeRandomProps, 'b'►`",
			'- `! iconClass` **string**',
			'- `!$ loading` **boolean**',
			'- `extraContent` **Snippet◄[boolean]►**',
			'- `onClick` **(event?: MouseEvent) =► void**',
			'`tooltipDelay` **number** = `500`'
		];
		const typeMissing = mustContain.filter((t) => !typeResult.updated.includes(t));
		const interfaceMissing = mustContain.filter((t) => !interfaceResult.updated.includes(t));
		assert.deepStrictEqual(
			typeMissing,
			[],
			'Missing expected fragments for type: ' + typeMissing.join(', ')
		);
		assert.deepStrictEqual(
			interfaceMissing,
			[],
			'Missing expected fragments for interface: ' + interfaceMissing.join(', ')
		);
	});

	// Check we can still match when there is no destructing going on for some reason and falling back to the propertyNameMatch setting
	it('falls back to propertyNameMatch when no destructuring', () => {
		const source = `<script>
		type SomeRandomProps = {
			a?: string;
			b?: number;
		};
		</script><div>No destructing here</div>`;
		const options: ProcessOptions = {
			propertyNameMatch: ['*Props'],
			addDescription: false,
			placeDescriptionBeforeProps: false
		};
		const r = processSvelteDoc(source, options);
		console.log(r.updated);

		const mustContain = ['`a` **string**', '`b` **number**'];
		const missing = mustContain.filter((t) => !r.updated.includes(t));
		assert.deepStrictEqual(
			missing,
			[],
			'Missing expected fragments for type: ' + missing.join(', ')
		);
	});

	// Check that the existing description is preserved when updating
	it('preserves existing description when updating', () => {
		const initial = `<!-- @component
This is my description.
--><script lang="ts">
    type XProps = { a: string };
    const { a = 'x' }: XProps = $props();
</script>`;
		const options: ProcessOptions = {
			propertyNameMatch: ['*Props'],
			addDescription: true,
			placeDescriptionBeforeProps: true
		};
		const out = processSvelteDoc(initial, options);
		assert.strictEqual(out.changed, true);
		assert.ok(out.updated.includes('This is my description.'));
	});

	it('skips when no TS <script> present', () => {
		const source = `<div>No script here</div>`;
		const options: ProcessOptions = {
			propertyNameMatch: ['*Props'],
			addDescription: false,
			placeDescriptionBeforeProps: false
		};
		const r = processSvelteDoc(source, options);
		assert.strictEqual(r.changed, false);
		assert.strictEqual(r.updated, source);
	});

	it('skips when no Props present', () => {
		const source = `<script>let x = $state("Hello, World");</script><div>No props here</div>`;
		const options: ProcessOptions = {
			propertyNameMatch: ['*Props'],
			addDescription: false,
			placeDescriptionBeforeProps: false
		};
		const r = processSvelteDoc(source, options);
		assert.strictEqual(r.changed, false);
		assert.strictEqual(r.updated, source);
	});
});
