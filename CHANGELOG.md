# Change Log

All notable changes to this project will be documented in this file.

## [2.0.0](https://github.com/LukeBurke99/sveltedoc/compare/v1.2.0...v2.0.0) (2025-11-27)

### ⚠ BREAKING CHANGES

* v2.0.0 completely replaces v1 functionality.

v1 generated `<!-- @component -->` blocks in files on save.
v2 provides real-time hover tooltips without modifying files.

**Removed:**
- Documentation block generation
- All v1 settings (documentOnSave, filesToDocument, propertyNameMatch, etc.)

**Added:**
- Hover tooltips showing props, types, JSDoc comments, and defaults
- Smart import resolution (relative paths, tsconfig aliases, workspace packages)
- Barrel file resolution for monorepo packages
- In-memory caching with automatic invalidation
- Customizable tooltip formats and sorting options

**Migration:**
Existing components work immediately. Hover over component tags to see tooltips. You can now remove the `@component` blocks from your components.

### ✨ Features

* rework the extension to be less intrusive and more stable, using a new hover provider instead of `[@component](https://github.com/component)` blocks. ([a68573f](https://github.com/LukeBurke99/sveltedoc/commit/a68573f9031b0a7f5b338f4d6603e98519220913))

## [1.2.0](https://github.com/LukeBurke99/sveltedoc/compare/v1.1.0...v1.2.0) (2025-09-17)

### ✨ Features

* Add functionality to strip comments from code snippets in documentation processing. ([9bd070c](https://github.com/LukeBurke99/sveltedoc/commit/9bd070c9fb5e5a1f6acddf1a8262f20c6e9d7141)), closes [#3](https://github.com/LukeBurke99/sveltedoc/issues/3)

## [1.1.0](https://github.com/LukeBurke99/sveltedoc/compare/v1.0.5...v1.1.0) (2025-09-14)

### ✨ Features

* Add escapeAngleBrackets option to handle angle bracket formatting in documentation ([c1f8a1d](https://github.com/LukeBurke99/sveltedoc/commit/c1f8a1dbff7bfc703f59a7575a63c4e60af2d579))

## [1.0.5](https://github.com/LukeBurke99/sveltedoc/compare/v1.0.4...v1.0.5) (2025-09-14)

### 🐛 Bug Fixes

* Enhance description formatting in generated comments and tests. ([74bbe4a](https://github.com/LukeBurke99/sveltedoc/commit/74bbe4a4ee1e7ad5c1fbad7ce9ea558621a399bd)), closes [#2](https://github.com/LukeBurke99/sveltedoc/issues/2)

## [1.0.4](https://github.com/LukeBurke99/sveltedoc/compare/v1.0.3...v1.0.4) (2025-09-03)

### 🐛 Bug Fixes

* Improve display of default values. ([2e99c59](https://github.com/LukeBurke99/sveltedoc/commit/2e99c594359d68db0cc95c6d4a7436f561e4ae33))

## [1.0.3](https://github.com/LukeBurke99/sveltedoc/compare/v1.0.2...v1.0.3) (2025-09-02)

### 🐛 Bug Fixes

* Remove package-lock.json from release assets and update publish command syntax ([6a41002](https://github.com/LukeBurke99/sveltedoc/commit/6a410024f2871d2dac3b1b62b24ec6a159ad0b62))

## [1.0.2](https://github.com/LukeBurke99/sveltedoc/compare/v1.0.1...v1.0.2) (2025-09-02)

### 🐛 Bug Fixes

* Bug fixes ([b72729e](https://github.com/LukeBurke99/sveltedoc/commit/b72729eab9d147ae8c5baeb99c11eadb46a6b8fa))

## 1.0.1 (2025-08-30)

### 🐛 Bug Fixes

* Fixed some bugs.

### ✨ Features

* Added automation tests

## 1.0.0 (2025-08-29)

* Initial release.
