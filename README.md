# Git Tool

A lightweight desktop Git client (GitKraken / SourceTree style) that runs entirely on your machine.
No account, no login, no hosting-provider API: it drives the `git` executable installed on the system,
so your `~/.gitconfig`, SSH keys, ssh-agent, credential helpers (Git Credential Manager) and aliases just work.

## Requirements

- Node.js 20+ (developed with Node 22)
- Git installed and available on `PATH` (Git ≥ 2.23 recommended; older versions fall back to `checkout`/`reset`)

## Install

```bash
npm install
```

npm 11 blocks install scripts by default; `package.json` allow-lists `electron` and `esbuild`.
If Electron fails to start with a missing binary, run `node node_modules/electron/install.js`.

## Development

```bash
npm run dev        # Electron + Vite with hot reload
npm run typecheck  # TypeScript (strict) for main/preload and renderer
npm run lint
npm test           # parser + graph unit tests and integration tests on temporary Git repositories
```

> If the app exits with "Electron Store: You can only use this module from the Electron main process",
> `ELECTRON_RUN_AS_NODE=1` is set in your environment (some editor-spawned shells export it) and Electron is running
> as plain Node. Use `env -u ELECTRON_RUN_AS_NODE npm run dev`.

## Build

```bash
npm run build      # typecheck + bundle to out/
npm run start      # run the production bundle
```

## Packaging

```bash
npm run dist       # electron-builder → release/
```

| OS      | Target          |
| ------- | --------------- |
| macOS   | DMG             |
| Windows | NSIS installer  |
| Linux   | AppImage, deb   |

## Supported OS

macOS, Windows, Linux. Paths go through `node:path`, Git is spawned directly (no shell), and no shell syntax is assumed.

## Features

- Open repositories (native folder picker, `.git` validation), multiple repository tabs with branch + dirty indicator,
  session restore and recent repositories
- Working tree: unstaged / staged / merge-conflict sections, stage, unstage, stage all, unstage all,
  discard (with confirmation; untracked files get an explicit delete warning)
- Diff viewer: unified / split, ignore whitespace, copy, syntax highlighting, virtualized for large files
- Commit (Stage All & Commit when nothing is staged), commit details with changed files and per-file diff
- Commit graph: lanes computed from parents (not `git log --graph`), merge/branch curves, stable branch colors,
  branch/tag badges, lazy loading (100 commits per page) and row virtualization
- Branches: local / remote, checkout (double click), track remote branches, create (from HEAD, branch or commit),
  delete (force only after a second confirmation), merge into current branch
- Remote: fetch (`--all --prune`), pull, push with "No upstream configured → Push & Set Upstream",
  streamed progress and cancel
- Stash: create (with untracked), apply, pop, drop (confirmed), view stash files and diffs
- File watching (working tree + `.git/HEAD`, `index`, `refs`) with debounced refresh
- Operation log with Git output, error toasts with details, resizable panels, keyboard shortcuts

### Keyboard shortcuts

| Shortcut              | Action             |
| --------------------- | ------------------ |
| Cmd/Ctrl + O          | Open repository    |
| Cmd/Ctrl + Enter      | Commit             |
| Cmd/Ctrl + Shift + F  | Fetch              |
| Cmd/Ctrl + Shift + P  | Push               |
| Cmd/Ctrl + Shift + L  | Pull               |
| Cmd/Ctrl + R          | Refresh            |
| Cmd/Ctrl + W          | Close repository tab |

## Architecture

```
Renderer (React, Zustand)  →  preload (contextBridge)  →  IPC  →  main process  →  GitService  →  GitExecutor  →  git
```

```
src/
  shared/types.ts          types + API contract shared by all processes
  main/
    main.ts                window, menu, IPC registration
    git/executor.ts        GitExecutor: spawn git (args array), capture/stream output, timeout, cancel, errors
    git/*.ts               pure parsers (status, branch, log, diff, commit, remote, stash)
    services/              GitService (every git command), RepositoryService (id → validated path),
                           settings (electron-store), filesystem (open/reveal, watcher)
    ipc/                   handlers: validate arguments, map repositoryId → path, wrap results in Result<T>
  preload/preload.ts       window.git / window.repo / window.system — one method per IPC channel
  renderer/
    stores/                repository.store (per-repository state + refresh), git.store (actions + operation log),
                           ui.store (dialogs, menus, persisted panel sizes)
    utils/graph.ts         commit graph lane algorithm
    components/            layout, repository, graph, branches, changes, diff, commit, stash, dialogs
tests/                     vitest: parsers, graph, GitService against temporary repositories
```

Refreshes are split so cheap operations stay cheap: staging only reruns `git status`; history is reloaded
only when HEAD or refs move (commit, checkout, merge, pull, fetch, push). Every loaded page is reloaded together,
so scroll position and selection survive a refresh.

## Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; strict Content-Security-Policy.
- The renderer has no access to Node, `fs`, `child_process` or a shell. The preload exposes a fixed list of
  Git operations; there is no generic "run command" API.
- After a repository is opened, the renderer only sends its `repositoryId`. The main process maps it to the
  validated path, so IPC calls cannot target arbitrary folders. File paths for open/reveal must stay inside the repository.
- Git is always spawned with an argument array (never a shell string), so commit messages, branch names and
  file names cannot inject commands. Refs, hashes and stash names are validated; file arguments follow `--`.
- `GIT_TERMINAL_PROMPT=0` prevents hidden credential prompts from hanging the app; credential helpers and ssh-agent still work.
- Destructive operations (discard, delete untracked file, drop stash, force delete branch) always require confirmation;
  nothing uses `--force` / `-D` / `git clean` without the user asking for it.
