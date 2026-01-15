# Bucket Command Implementation Tracker

**Status**: Not Started  
**Started**: TBD  
**Target Completion**: TBD

## Overview

Implementing a comprehensive `bucket` command for swb with 6 subcommands based on sfsu's bucket system (excluding deprecated commands).

**Architecture**: Hybrid (main dispatcher + imported subcommand handlers)  
**Git Integration**: Bun shell commands (`$`)  
**Progress UI**: Detailed progress bars (sfsu-style)  
**Scope**: All 6 subcommands

---

## Phase 1: Foundation (Infrastructure)

### 1.1 Directory Structure

- [ ] Create `src/commands/bucket/` directory
- [ ] Verify `.todo/` directory exists
- [ ] This tracking document created ✓

### 1.2 Utility Modules

#### `src/lib/buckets.ts` - Bucket Path Utilities

- [ ] `getBucketsPath()` - Returns buckets directory path
- [ ] `getBucketPath(name)` - Returns specific bucket path
- [ ] `bucketExists(name)` - Check if bucket exists
- [ ] `getAllBuckets()` - List all bucket directories
- [ ] `getBucketManifestCount(path)` - Count manifests in bucket

#### `src/lib/git.ts` - Git Operations Wrapper

- [ ] `clone(url, dest, progress?)` - Clone repository with progress
- [ ] `pull(path, progress?)` - Pull updates with progress
- [ ] `getRemoteUrl(path)` - Get origin URL
- [ ] `isGitRepo(path)` - Check if directory is git repo
- [ ] `getLastCommitDate(path)` - Get last commit timestamp
- [ ] `hasRemoteUpdates(path)` - Check if remote has updates

### 1.3 Known Buckets Data

- [ ] Research Scoop's known buckets JSON format/location
- [ ] Create `src/utils/known-buckets.ts` with bucket registry
- [ ] Implement fallback if fetch fails

---

## Phase 2: Implement Subcommands

### 2.1 Bucket List (`src/commands/bucket/list.ts`)

**Priority**: 1 (Foundation command)

- [ ] Create file structure
- [ ] Scan buckets directory
- [ ] For each bucket gather:
  - [ ] Name (directory name)
  - [ ] Source URL (git remote)
  - [ ] Last update time (git log)
  - [ ] Manifest count
- [ ] Display in table format
- [ ] Support `--json` flag
- [ ] Handle errors (non-git directories, etc.)
- [ ] Add help text
- [ ] Test implementation

**Interface**:

```typescript
interface BucketInfo {
  name: string;
  source: string;
  updated: Date;
  manifests: number;
}
```

### 2.2 Bucket Add (`src/commands/bucket/add.ts`)

**Priority**: 2 (Most common operation)

- [ ] Create file structure
- [ ] Parse arguments (name required, repo optional)
- [ ] Lookup in known buckets if repo not provided
- [ ] Validate bucket doesn't already exist
- [ ] Create progress bar for clone operation
- [ ] Execute git clone with Bun shell
- [ ] Parse git progress from stderr:
  - [ ] Resolving deltas
  - [ ] Receiving objects
  - [ ] Transfer speed/ETA
- [ ] Verify clone success
- [ ] Display success message with manifest count
- [ ] Add help text
- [ ] Test implementation

**Interface**:

```typescript
interface AddArgs {
  name: string;
  repo?: string;
}
```

### 2.3 Bucket Remove (`src/commands/bucket/remove.ts`)

**Priority**: 3 (Paired with add)

- [ ] Create file structure
- [ ] Parse arguments (name required, --force optional)
- [ ] Validate bucket exists
- [ ] Check if it's "main" bucket (special warning)
- [ ] Check for installed apps from this bucket
- [ ] Prompt for confirmation (unless --force)
- [ ] Remove directory recursively
- [ ] Show success message
- [ ] Add help text
- [ ] Test implementation

**Interface**:

```typescript
interface RemoveArgs {
  name: string;
  force?: boolean;
}
```

### 2.4 Bucket Known (`src/commands/bucket/known.ts`)

**Priority**: 4 (Discovery helper)

- [ ] Create file structure
- [ ] Load known buckets from data file
- [ ] Display in table format:
  - [ ] Name
  - [ ] Source URL
  - [ ] Description (if available)
- [ ] Support `--json` flag
- [ ] Support filtering by name pattern
- [ ] Add help text
- [ ] Test implementation

### 2.5 Bucket Update (`src/commands/bucket/update.ts`)

**Priority**: 5 (Maintenance operation)

- [ ] Create file structure
- [ ] Parse arguments (optional bucket name, --changelog flag)
- [ ] If name provided, update single bucket
- [ ] If no name, update all buckets
- [ ] Create multi-progress bar (one per bucket)
- [ ] For each bucket:
  - [ ] Check if it's a git repo
  - [ ] Check for remote updates
  - [ ] Pull if updates available
  - [ ] Parse commit messages if --changelog
- [ ] Display summary (X updated, Y already up-to-date)
- [ ] Handle errors (network, conflicts, etc.)
- [ ] Add help text
- [ ] Test implementation

**Interface**:

```typescript
interface UpdateArgs {
  name?: string;
  changelog?: boolean;
}
```

### 2.6 Bucket Unused (`src/commands/bucket/unused.ts`)

**Priority**: 6 (Cleanup/optimization)

- [ ] Create file structure
- [ ] Get all installed apps (from apps directory)
- [ ] Extract bucket name from each app's manifest
- [ ] Get list of all buckets
- [ ] Find buckets not referenced by any installed app
- [ ] Display unused bucket names
- [ ] Support `--json` flag
- [ ] Optional: Suggest removal with warning
- [ ] Add help text
- [ ] Test implementation

---

## Phase 3: Main Command Integration

### 3.1 Main Dispatcher (`src/commands/bucket/index.ts`)

- [ ] Create main command file
- [ ] Import all subcommand handlers
- [ ] Implement subcommand routing switch
- [ ] Support aliases (rm for remove, ls for list)
- [ ] Add main command help text
- [ ] Add per-subcommand help text
- [ ] Handle unknown subcommands gracefully
- [ ] Support `swb bucket --help`
- [ ] Export CommandDefinition

**Structure**:

```typescript
export const definition: CommandDefinition = {
  name: "bucket",
  description: "Manage Scoop buckets",
  usage: "swb bucket <subcommand> [options]",
  handler: async (args: ParsedArgs): Promise<number> => {
    // Route to subcommands
  },
};
```

### 3.2 Command Registry Integration

- [ ] Import bucket command in `src/lib/commands.ts`
- [ ] Add to `commandRegistry` object
- [ ] Verify command appears in `swb --help`
- [ ] Test command execution

---

## Phase 4: Progress & UI Enhancement

### 4.1 Detailed Progress Bars

- [ ] For `add`: Clone progress implementation
  - [ ] Parse git objects received/total
  - [ ] Parse delta resolution progress
  - [ ] Show transfer speed
  - [ ] Show ETA if available
- [ ] For `update`: Multi-progress implementation
  - [ ] Create separate progress bar per bucket
  - [ ] Show overall completion percentage
  - [ ] Handle concurrent updates gracefully
- [ ] For long operations: Spinner + status message
- [ ] Ensure progress bars work on Windows terminals

### 4.2 Error Messages & Handling

- [ ] Network errors (git clone/pull failures)
- [ ] Permission errors (can't write to buckets dir)
- [ ] Invalid bucket names/URLs
- [ ] Bucket already exists error
- [ ] Bucket not found error
- [ ] Git not available error
- [ ] Disk space errors
- [ ] Repository corruption errors

---

## Phase 5: Testing

### 5.1 Unit Tests (`tests/commands/bucket.test.ts`)

- [ ] Create test file structure
- [ ] Mock bucket utilities
- [ ] Test bucket list:
  - [ ] With buckets present
  - [ ] With empty directory
  - [ ] With JSON flag
- [ ] Test bucket add:
  - [ ] Valid bucket name with URL
  - [ ] Valid bucket name from known buckets
  - [ ] Invalid bucket name
  - [ ] Bucket already exists
  - [ ] Network failure
- [ ] Test bucket remove:
  - [ ] Successful removal
  - [ ] With confirmation prompt
  - [ ] With --force flag
  - [ ] Bucket not found
- [ ] Test bucket known:
  - [ ] List all known buckets
  - [ ] Filter by name
  - [ ] JSON output
- [ ] Test bucket update:
  - [ ] Single bucket update
  - [ ] All buckets update
  - [ ] With changelog flag
  - [ ] No updates available
- [ ] Test bucket unused:
  - [ ] Find unused buckets
  - [ ] All buckets in use
  - [ ] JSON output

### 5.2 Integration Tests

- [ ] Test actual bucket add operation (cleanup after)
- [ ] Test actual bucket remove operation
- [ ] Test bucket update with real git operations
- [ ] Test progress bar rendering
- [ ] Test help text display for all commands
- [ ] Test error scenarios with real operations

---

## Phase 6: Documentation & Polish

### 6.1 Documentation

- [ ] Add bucket command section to README.md
- [ ] Add examples for each subcommand
- [ ] Document common use cases
- [ ] Update AGENTS.md if needed
- [ ] Add troubleshooting section

### 6.2 Code Quality

- [ ] Run `bun run format` on all new files
- [ ] Ensure TypeScript strict mode compliance
- [ ] Add JSDoc comments to all exported functions
- [ ] Handle edge cases and corner cases
- [ ] Review error messages for clarity
- [ ] Ensure consistent code style with existing commands

---

## Implementation Notes

### Git Operations Pattern (Bun)

```typescript
// Clone with progress tracking
const proc = Bun.spawn(["git", "clone", "--progress", url, dest], {
  stderr: "pipe",
});

for await (const chunk of proc.stderr) {
  const text = new TextDecoder().decode(chunk);
  // Parse progress and update UI
}
```

### Progress Bar Pattern

```typescript
import { ProgressBar } from "src/utils/loader.ts";

const pb = new ProgressBar(total, "Operation description");
pb.start();
// Update as operation progresses
pb.update(current);
pb.stop();
```

### Table Output Pattern

```typescript
import { log } from "src/utils/logger.ts";

buckets.forEach(bucket => {
  log(`  ${bucket.name.padEnd(20)} ${bucket.source.padEnd(50)} ${bucket.manifests} manifests`);
});
```

---

## Acceptance Criteria

- [ ] All 6 subcommands implemented and working
- [ ] Detailed progress bars for long-running operations
- [ ] Consistent error handling and user-friendly messages
- [ ] All commands support `--json` flag where applicable
- [ ] Help text complete and accurate for all commands
- [ ] Tests pass with >80% coverage
- [ ] No TypeScript compilation errors
- [ ] Code follows swb style guide (prettier formatted)
- [ ] README updated with bucket command documentation
- [ ] All commands work on Windows x64

---

## Time Estimates

- **Phase 1** (Foundation): 2-3 hours
- **Phase 2** (Subcommands): 6-8 hours
  - List: 1 hour
  - Add: 1.5 hours
  - Remove: 1 hour
  - Known: 0.5 hours
  - Update: 2 hours
  - Unused: 1 hour
- **Phase 3** (Integration): 1-2 hours
- **Phase 4** (Progress/UI): 2-3 hours
- **Phase 5** (Testing): 3-4 hours
- **Phase 6** (Docs/Polish): 1-2 hours

**Total Estimated Time**: 15-22 hours

---

## Risk Mitigation

| Risk                      | Mitigation Strategy                                          |
| ------------------------- | ------------------------------------------------------------ |
| Git parsing complexity    | Use simple stderr parsing, avoid over-engineering            |
| Windows path handling     | Use existing `path.win32` utilities consistently             |
| Concurrent git operations | Implement sequential updates first, optimize later if needed |
| Large bucket clones       | Ensure progress bars handle large data transfers gracefully  |
| Git not installed         | Clear error message directing user to install Git            |
| Network timeouts          | Implement reasonable timeouts and retry logic                |

---

## Progress Tracking

### Completed Tasks

- [x] Planning and design
- [x] Create todo tracking document

### Current Focus

- [ ] Phase 1: Foundation setup

### Next Steps

1. Create directory structure
2. Implement bucket utilities
3. Implement git wrapper
4. Start with bucket list command

---

## Questions & Decisions

### Resolved

- ✓ Architecture: Hybrid approach (main file + imports)
- ✓ Git integration: Use Bun shell commands
- ✓ Progress detail: Detailed progress bars
- ✓ Feature scope: All 6 subcommands

### Open Questions

- None currently

---

**Last Updated**: 2026-01-15  
**Status**: Ready to begin implementation
