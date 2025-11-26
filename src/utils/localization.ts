import * as nls from 'vscode-nls';
import translations from '../../package.nls.json';

const localize = nls.loadMessageBundle();
type TranslationKey = keyof typeof translations;

/**
 * Translate a given key using the loaded translations.
 * @param key The translation key to look up.
 * @param args Optional arguments to format the translation string.
 * @returns The localized string.
 */
export function t(key: TranslationKey, ...args: any[]): string {
	return localize(key, translations[key], ...args);
}
