import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-eslint';

// Respect .gitignore if present
const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));
const maybeIgnore = fs.existsSync(gitignorePath) ? [includeIgnoreFile(gitignorePath)] : [];

export default ts.config(
	// .gitignore (if present)
	...maybeIgnore,

	// Base JS recommendations
	js.configs.recommended,

	// TS configs (with type-checking)
	...ts.configs.recommendedTypeChecked,
	...ts.configs.strictTypeChecked,
	...ts.configs.stylisticTypeChecked,

	// Prettier for formatting consistency
	prettier,

	// Project-specific ignores
	{
		ignores: ['eslint.config.js', 'out/', 'dist/']
	},

	// Language options and globals
	{
		languageOptions: {
			globals: {
				...globals.node
			},
			parserOptions: {
				project: './tsconfig.json',
				tsconfigRootDir: import.meta.dirname
			}
		}
	},

	// Plugins and custom rules
	{
		plugins: { unicorn },
		rules: {
			// ----- JavaScript / TypeScript rules -----
			semi: ['error', 'always'],
			quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
			curly: ['error', 'multi', 'consistent'],
			'sort-imports': [
				'error',
				{
					ignoreCase: true,
					ignoreDeclarationSort: true,
					allowSeparatedGroups: true
				}
			],
			'no-console': 'off',
			// Prefer ternary expressions over simple if/else return or assignment
			'unicorn/prefer-ternary': 'error',

			// Explicitness like C#
			'@typescript-eslint/explicit-function-return-type': [
				'error',
				{
					allowExpressions: true,
					allowTypedFunctionExpressions: true
				}
			],
			'@typescript-eslint/explicit-module-boundary-types': 'error',
			'@typescript-eslint/typedef': [
				'error',
				{
					arrowParameter: false,
					memberVariableDeclaration: true,
					objectDestructuring: true,
					parameter: true,
					propertyDeclaration: true,
					variableDeclaration: false
				}
			],
			'@typescript-eslint/explicit-member-accessibility': [
				'error',
				{ accessibility: 'explicit' }
			],
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/consistent-type-definitions': ['error', 'type'],
			'@typescript-eslint/no-inferrable-types': 'off',
			'@typescript-eslint/no-extraneous-class': 'off',
			'@typescript-eslint/no-confusing-void-expression': [
				'error',
				{ ignoreArrowShorthand: true }
			],
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-redundant-type-constituents': 'off',
			'@typescript-eslint/restrict-template-expressions': [
				'error',
				{
					allowAny: true,
					allowNumber: false,
					allowBoolean: false,
					allowNullish: false,
					allowRegExp: false,
					allowNever: false,
					allowArray: false
				}
			]
		}
	}
);
