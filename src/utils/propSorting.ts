import { PropInfo, TooltipOrder } from '../types';

/**
 * Type category rankings for smart type-based sorting.
 */
const TYPE_CATEGORIES: Record<string, number> = {
	PRIMITIVE: 0,
	CUSTOM: 1,
	ARRAY: 2,
	OBJECT: 3,
	FUNCTION: 4
};

/**
 * Primitive types in preferred display order.
 */
const PRIMITIVE_ORDER: string[] = [
	'string',
	'number',
	'boolean',
	'null',
	'undefined',
	'symbol',
	'bigint'
];

/**
 * Categorize a TypeScript type string into a category.
 * @param type The type string to categorize
 * @returns The category rank (lower = appears first)
 */
export function categorizeType(type: string): number {
	const normalized = type.trim().toLowerCase();

	// Check for primitives (exact match)
	if (PRIMITIVE_ORDER.includes(normalized)) return TYPE_CATEGORIES.PRIMITIVE;

	// Check for functions (contains => or starts with ()
	if (type.includes('=>') || /^\s*\(/.test(type)) return TYPE_CATEGORIES.FUNCTION;

	// Check for arrays/tuples (starts with [, contains [], or Array<)
	// Must check before object literal check since tuples contain {}
	if (type.includes('[]') || /Array\s*</.test(type) || /^\s*\[/.test(type))
		return TYPE_CATEGORIES.ARRAY;

	// Check for complex types (unions, generics, objects)
	// Unions: |, Generics: <>, Objects: {}
	if (type.includes('|') || type.includes('<') || type.includes('{'))
		return TYPE_CATEGORIES.OBJECT;

	// Simple custom types (e.g., MyType, SomeInterface)
	return TYPE_CATEGORIES.CUSTOM;
}

/**
 * Get the primitive type order index, or -1 if not a primitive.
 */
export function getPrimitiveOrder(type: string): number {
	const normalized = type.trim().toLowerCase();
	const index = PRIMITIVE_ORDER.indexOf(normalized);
	return index;
}

/**
 * Sort props according to the specified order preference.
 * @param props The list of PropInfo objects to sort
 * @param order The sorting preference
 * @returns Sorted copy of props array
 */
export function sortProps(props: PropInfo[], order: TooltipOrder): PropInfo[] {
	// For "normal" order, return props as-is (declaration order)
	if (order === 'normal') return props;

	const sorted = [...props];

	switch (order) {
		case 'alphabetical':
			// Alphabetical by property name
			sorted.sort((a, b) => a.name.localeCompare(b.name));
			break;

		case 'required':
			// Required first, then optional (alphabetically within groups)
			sorted.sort((a, b) => {
				if (a.required !== b.required) return a.required ? -1 : 1;
				return a.name.localeCompare(b.name);
			});
			break;

		case 'type':
			// Smart type categorization: primitives → custom → arrays → objects → functions
			sorted.sort((a, b) => {
				const catA = categorizeType(a.type);
				const catB = categorizeType(b.type);

				// First sort by category
				if (catA !== catB) return catA - catB;

				// Within primitives, use defined order
				if (catA === TYPE_CATEGORIES.PRIMITIVE) {
					const orderA = getPrimitiveOrder(a.type);
					const orderB = getPrimitiveOrder(b.type);
					if (orderA !== orderB) return orderA - orderB;
				}

				// Within same category, sort alphabetically by type
				const typeCompare = a.type.localeCompare(b.type);
				if (typeCompare !== 0) return typeCompare;

				// Finally by property name
				return a.name.localeCompare(b.name);
			});
			break;
	}

	return sorted;
}
