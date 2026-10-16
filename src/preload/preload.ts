import { contextBridge, ipcRenderer } from 'electron'
import type { GitApi, ProgressEvent, RepoApi, RepoChangedEvent, SystemApi } from '../shared/types'

// Each method maps to exactly one IPC channel; nothing generic (no shell / exec) is exposed.
const invoke =
  (channel: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args)

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrapped = (_event: unknown, payload: T): void => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

const git: GitApi = {
  status: invoke('git:status'),
  branches: invoke('git:branches'),
  remotes: invoke('git:remotes'),
  log: invoke('git:log'),
  tags: invoke('git:tags'),
  diff: invoke('git:diff'),
  commitFiles: invoke('git:commitFiles'),
  stage: invoke('git:stage'),
  stageAll: invoke('git:stageAll'),
  unstage: invoke('git:unstage'),
  unstageAll: invoke('git:unstageAll'),
  discard: invoke('git:discard'),
  deleteUntracked: invoke('git:deleteUntracked'),
  commit: invoke('git:commit'),
  headMessage: invoke('git:headMessage'),
  blame: invoke('git:blame'),
  checkout: invoke('git:checkout'),
  checkoutRemote: invoke('git:checkoutRemote'),
  checkoutCommit: invoke('git:checkoutCommit'),
  createBranch: invoke('git:createBranch'),
  deleteBranch: invoke('git:deleteBranch'),
  merge: invoke('git:merge'),
  rebase: invoke('git:rebase'),
  rebaseContinue: invoke('git:rebaseContinue'),
  rebaseSkip: invoke('git:rebaseSkip'),
  rebaseCommits: invoke('git:rebaseCommits'),
  interactiveRebase: invoke('git:interactiveRebase'),
  bisectStart: invoke('git:bisectStart'),
  bisectMark: invoke('git:bisectMark'),
  worktrees: invoke('git:worktrees'),
  addWorktree: invoke('git:addWorktree'),
  removeWorktree: invoke('git:removeWorktree'),
  pruneWorktrees: invoke('git:pruneWorktrees'),
  submodules: invoke('git:submodules'),
  updateSubmodules: invoke('git:updateSubmodules'),
  lfs: invoke('git:lfs'),
  lfsPull: invoke('git:lfsPull'),
  gitFlow: invoke('git:gitFlow'),
  gitFlowInit: invoke('git:gitFlowInit'),
  gitFlowStart: invoke('git:gitFlowStart'),
  gitFlowFinish: invoke('git:gitFlowFinish'),
  cherryPick: invoke('git:cherryPick'),
  revert: invoke('git:revert'),
  reset: invoke('git:reset'),
  abortOperation: invoke('git:abortOperation'),
  resolveConflict: invoke('git:resolveConflict'),
  createTag: invoke('git:createTag'),
  deleteTag: invoke('git:deleteTag'),
  pushTag: invoke('git:pushTag'),
  fetch: invoke('git:fetch'),
  pull: invoke('git:pull'),
  push: invoke('git:push'),
  fetchRemote: invoke('git:fetchRemote'),
  addRemote: invoke('git:addRemote'),
  removeRemote: invoke('git:removeRemote'),
  setRemoteUrl: invoke('git:setRemoteUrl'),
  cancel: invoke('git:cancel'),
  stashes: invoke('git:stashes'),
  stash: invoke('git:stash'),
  stashApply: invoke('git:stashApply'),
  stashPop: invoke('git:stashPop'),
  stashDrop: invoke('git:stashDrop'),
  onProgress: (listener) => subscribe<ProgressEvent>('git:progress', listener)
}

const repo: RepoApi = {
  openDialog: invoke('repo:openDialog'),
  open: invoke('repo:open'),
  init: invoke('repo:init'),
  close: invoke('repo:close'),
  setActive: invoke('repo:setActive'),
  session: invoke('repo:session'),
  onChanged: (listener) => subscribe<RepoChangedEvent>('repo:changed', listener)
}

const system: SystemApi = {
  platform: process.platform,
  openFile: invoke('system:openFile'),
  reveal: invoke('system:reveal'),
  openInEditor: invoke('system:openInEditor'),
  openTerminal: invoke('system:openTerminal'),
  openFolder: invoke('system:openFolder'),
  settings: invoke('system:settings'),
  pickGitExecutable: invoke('system:pickGitExecutable'),
  resetGitExecutable: invoke('system:resetGitExecutable')
}

contextBridge.exposeInMainWorld('git', git)
contextBridge.exposeInMainWorld('repo', repo)
contextBridge.exposeInMainWorld('system', system)
