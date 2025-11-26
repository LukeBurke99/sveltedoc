/**
 * Tracks hover state to prevent duplicate logging for the same hover location.
 */
export class HoverStateCache {
	private currentFile: string | undefined;
	private currentTag: string | undefined;
	private currentComponentPath: string | undefined;

	/**
	 * Check if the current hover is for the same file and tag as the last hover.
	 * @param file The current file path
	 * @param tag The current tag name
	 * @return True if same hover, false otherwise
	 */
	public isSameHover(file: string, tag: string): boolean {
		return this.currentFile === file && this.currentTag === tag;
	}

	/**
	 * Check if the current hover is for the same component (file, tag, and path) as the last hover.
	 * @param file The current file path
	 * @param tag The current tag name
	 * @param componentPath The resolved component file path, if any
	 * @return True if same component, false otherwise
	 */
	public isSameComponent(file: string, tag: string, componentPath: string | undefined): boolean {
		return (
			this.currentFile === file &&
			this.currentTag === tag &&
			this.currentComponentPath === componentPath
		);
	}

	/**
	 * Update the hover state to track the current hover location.
	 * @param file The current file path
	 * @param tag The current tag name
	 * @param componentPath The resolved component file path, if any
	 */
	public setHover(file: string, tag: string, componentPath: string | undefined): void {
		this.currentFile = file;
		this.currentTag = tag;
		this.currentComponentPath = componentPath;
	}

	/**
	 * Clear the hover state.
	 */
	public clear(): void {
		this.currentFile = undefined;
		this.currentTag = undefined;
		this.currentComponentPath = undefined;
	}
}
