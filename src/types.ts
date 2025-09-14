/**
 * A single documented prop of a Svelte component.
 * - optional indicates presence of ? in the type alias.
 * - bindable is true when a default is created using $bindable(...).
 */
export type PropDoc = {
	/** prop identifier as declared in the type alias */
	name: string;
	/** text of the type (rendered verbatim in code font) */
	typeText: string;
	/** whether the prop is optional */
	optional: boolean;
	/** default value text taken from destructuring (if any) */
	defaultText?: string;
	/** whether the default uses $bindable(inner) */
	bindable: boolean;
	/** short description from inline JSDoc (first paragraph) */
	description?: string;
};

/**
 * Result of extracting documentation metadata from TypeScript code.
 */
export type ExtractResult = {
	/** inferred type alias name for props when found */
	inferredTypeName?: string;
	/** ordered list of props */
	props: PropDoc[];
	/** non-object intersection members (e.g., HTMLAttributes<...>) */
	inherits: string[];
	/** true when destructuring used a rest pattern ...rest */
	hasRest: boolean;
	/** debug lines describing detection steps */
	debug: string[];
};

/**
 * Options used when rendering a @component block.
 */
export type BuildOptions = {
	/** whether to include the free-form description in the block */
	addDescription: boolean;
	/** if true, place the description before props; else after */
	placeDescriptionBeforeProps: boolean;
	/** previously captured description text (if any) */
	existingDescription: string;
	/** intersection types to render in the inherits line */
	inherits: string[];
	/** props to render as bullets */
	props: PropDoc[];
	/** whether to escape angle brackets (< >) with placeholder characters */
	escapeAngleBrackets: boolean;
};

/**
 * Options that control how SvelteDoc processes a single file.
 */
export type ProcessOptions = {
	/** patterns to find a props type alias when not inferred from $props() */
	propertyNameMatch: string[];
	/** include description or not */
	addDescription: boolean;
	/** placement of description relative to props */
	placeDescriptionBeforeProps: boolean;
	/** whether to escape angle brackets (< >) with placeholder characters */
	escapeAngleBrackets: boolean;
};
