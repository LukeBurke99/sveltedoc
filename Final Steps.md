# SvelteDoc - Final Steps Analysis

This document provides a detailed analysis of all remaining tasks in `TASKS.md`, evaluating their current implementation status, what already exists, what would need to change, and whether the effort is worthwhile.

---

## Table of Contents

1. [Phase 2: npm/yarn Workspaces + node_modules](#1-phase-2-npmyarn-workspaces--node_modules)
2. [Integration Test: Hover Provider](#2-integration-test-hover-provider)
3. [Settings Ordering Test](#3-settings-ordering-test)
4. [Phase 3: Real-world Testing](#4-phase-3-real-world-testing)

---


## 1. Phase 2: npm/yarn Workspaces + node_modules

### Task Description
> Phase 2: Enhanced node_modules resolution (npm/yarn workspaces) - See PHASE2.md

### Has It Been Implemented? ❌ **NO**

### What Already Exists
- pnpm-workspace.yaml detection and resolution
- Barrel file resolution
- Conditional exports support

### What Would Need to Change
1. Install `enhanced-resolve` package
2. Detect npm/yarn workspaces (package.json with `workspaces` field)
3. Create `PackageResolver` class for node_modules
4. Handle `svelte` field priority in package.json
5. Integrate with existing PathResolver

See `PHASE2.md` for detailed implementation plan.

### Is It Worth It?
**🟡 MEDIUM PRIORITY**

- Expands compatibility beyond pnpm users
- npm/yarn workspaces are common
- Adds dependency and complexity

**Recommendation:** Implement when user demand arises

---

## 2. Integration Test: Hover Provider

### Task Description
> Integration test: hover provider shows placeholder on component tag

### Has It Been Implemented? ❌ **NO**

### What Already Exists
- 172 unit tests covering:
  - Prop parsing (34 tests)
  - Script extraction (6 tests)
  - Tooltip ordering (12 tests)
  - Type categorization (15 tests)
  - Path resolution (25+ tests)
  - Tag parsing (28 tests)

### What Would Need to Change
1. Set up VS Code extension test harness (`@vscode/test-electron`)
2. Create test fixtures with real .svelte files
3. Write tests that:
   - Open a Svelte document
   - Trigger hover at specific position
   - Assert returned Hover content

### Is It Worth It?
**🟡 MEDIUM PRIORITY**

- Unit tests cover most logic
- Integration tests would catch registration/wiring issues
- Adds CI complexity and test run time

**Recommendation:** Add if you experience bugs that unit tests don't catch

---

## 3. Settings Ordering Test

### Task Description
> Settings ordering test: verify output sort changes per setting

### Has It Been Implemented? ⚠️ **PARTIALLY**

### What Already Exists
- `tooltipFormatter.order.test.ts` - 12 tests for sorting modes
- `tooltipFormatter.typeCategories.test.ts` - 15 tests for type categorization
- Tests call `sortProps()` directly, not through settings

### What Would Need to Change
1. Add test that:
   - Mocks `Settings.getTooltipOrder()` return value
   - Calls `TooltipFormatter.formatTooltip()`
   - Asserts output order matches setting

### Is It Worth It?
**🟢 LOW PRIORITY**

- Current tests verify sorting logic works correctly
- Settings → sorting integration is trivial (direct value pass-through)
- Not likely to break

**Recommendation:** Remove or mark as covered by existing tests

---

## 4. Phase 3: Real-world Testing

### Task Description
> Phase 3: Real-world testing with live projects

### Has It Been Implemented? ⚠️ **PARTIALLY**

### What Already Exists
- Unit tests with fixtures
- Developer's own projects used for testing

### What Would Need to Change
1. Create checklist of test scenarios
2. Test with popular Svelte projects (SvelteKit, Skeleton, etc.)
3. Document edge cases found
4. Fix issues discovered

### Is It Worth It?
**🟡 MEDIUM PRIORITY**

- Important before major releases
- Low effort, high value for bug finding

**Recommendation:** Do before publishing to marketplace

---

## Summary: Tasks to Update in TASKS.md


| Task | Priority | Notes |
|------|----------|-------|
| Marketplace demo GIF | 🔴 HIGH | 30-minute task, high marketing impact |
| Integration test: hover provider | 🟡 MEDIUM | Add if unit tests miss bugs |
| Phase 3: Real-world testing | 🟡 MEDIUM | Do before marketplace publish |
| Multi-root workspace | 🟢 LOW | Niche use case |
| Jump-to-definition | 🟡 MEDIUM | High value, needs location tracking |
| Phase 2: npm/yarn | 🟡 MEDIUM | Implement on user demand |

---