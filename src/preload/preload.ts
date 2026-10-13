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
  checkout: invoke('git:checkout'),
  checkoutRemote: invoke('git:checkoutRemote'),
  checkoutCommit: invoke('git:checkoutCommit'),
  createBranch: invoke('git:createBranch'),
  deleteBranch: invoke('git:deleteBranch'),
  merge: invoke('git:merge'),
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
  close: invoke('repo:close'),
  setActive: invoke('repo:setActive'),
  session: invoke('repo:session'),
  onChanged: (listener) => subscribe<RepoChangedEvent>('repo:changed', listener)
}

const system: SystemApi = {
  platform: process.platform,
  openFile: invoke('system:openFile'),
  reveal: invoke('system:reveal')
}

contextBridge.exposeInMainWorld('git', git)
contextBridge.exposeInMainWorld('repo', repo)
contextBridge.exposeInMainWorld('system', system)
