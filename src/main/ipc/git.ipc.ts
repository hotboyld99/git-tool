import type { DiffRequest, LogOptions, ProgressEvent, ResetMode } from '../../shared/types'
import type { GitService } from '../services/git.service'
import type { RepositoryService } from '../services/repository.service'
import { bool, handle, int, obj, str, strs } from './handle'

function diffRequest(v: unknown): DiffRequest {
  const r = obj(v)
  const ignoreWhitespace = bool(r.ignoreWhitespace)
  if (r.kind === 'commit') return { kind: 'commit', hash: str(r.hash), path: str(r.path), ignoreWhitespace }
  return { kind: 'working', path: str(r.path), staged: bool(r.staged), untracked: bool(r.untracked), conflicted: bool(r.conflicted), ignoreWhitespace }
}

const optionalStr = (v: unknown): string | undefined => (v === undefined || v === '' ? undefined : str(v))

function logOptions(v: unknown): LogOptions {
  const o = obj(v)
  return { skip: int(o.skip, 0, 1e9), limit: int(o.limit, 1, 50_000), search: optionalStr(o.search), author: optionalStr(o.author), ref: optionalStr(o.ref) }
}

export function registerGitIpc(repos: RepositoryService, git: GitService, sendProgress: (event: ProgressEvent) => void): void {
  const path = (id: unknown): string => repos.get(id).path
  const progress = (id: unknown) => (text: string) => sendProgress({ repoId: str(id), text })

  handle('git:status', (id) => git.status(path(id)))
  handle('git:branches', (id) => git.getBranches(path(id)))
  handle('git:remotes', (id) => git.getRemotes(path(id)))
  handle('git:log', (id, o) => git.getLog(path(id), logOptions(o)))
  handle('git:tags', (id) => git.getTags(path(id)))
  handle('git:diff', (id, req) => git.getDiff(path(id), diffRequest(req)))
  handle('git:commitFiles', (id, hash) => git.getCommitFiles(path(id), str(hash)))

  handle('git:stage', (id, files) => git.stage(path(id), strs(files)))
  handle('git:stageAll', (id) => git.stageAll(path(id)))
  handle('git:unstage', (id, files) => git.unstage(path(id), strs(files)))
  handle('git:unstageAll', (id) => git.unstageAll(path(id)))
  handle('git:discard', (id, files) => git.discard(path(id), strs(files)))
  handle('git:deleteUntracked', (id, files) => git.deleteUntracked(path(id), strs(files)))
  handle('git:commit', (id, message, amend) => git.commit(path(id), str(message), bool(amend)))
  handle('git:headMessage', (id) => git.headMessage(path(id)))
  handle('git:blame', (id, file, hash) => git.blame(path(id), str(file), hash === null ? null : str(hash)))

  handle('git:checkout', (id, branch) => git.checkout(path(id), str(branch)))
  handle('git:checkoutRemote', (id, branch) => git.checkoutRemote(path(id), str(branch)))
  handle('git:checkoutCommit', (id, hash) => git.checkoutCommit(path(id), str(hash)))
  handle('git:createBranch', (id, name, start, checkout) =>
    git.createBranch(path(id), str(name), start === null ? null : str(start), bool(checkout))
  )
  handle('git:deleteBranch', (id, name, force) => git.deleteBranch(path(id), str(name), bool(force)))
  handle('git:merge', (id, branch) => git.merge(path(id), str(branch)))
  handle('git:rebase', (id, onto) => git.rebase(path(id), str(onto)))
  handle('git:rebaseContinue', (id) => git.rebaseContinue(path(id)))
  handle('git:rebaseSkip', (id) => git.rebaseSkip(path(id)))
  handle('git:cherryPick', (id, hash) => git.cherryPick(path(id), str(hash)))
  handle('git:revert', (id, hash) => git.revert(path(id), str(hash)))
  handle('git:reset', (id, hash, mode) => git.reset(path(id), str(hash), str(mode) as ResetMode))
  handle('git:abortOperation', (id) => git.abortOperation(path(id)))
  handle('git:resolveConflict', (id, files, side) => git.resolveConflict(path(id), strs(files), str(side) as 'ours' | 'theirs'))
  handle('git:createTag', (id, name, hash, message) => git.createTag(path(id), str(name), str(hash), str(message)))
  handle('git:deleteTag', (id, name) => git.deleteTag(path(id), str(name)))
  handle('git:pushTag', (id, name) => git.pushTag(path(id), str(name), progress(id)))

  handle('git:fetch', (id) => git.fetch(path(id), progress(id)))
  handle('git:pull', (id) => git.pull(path(id), progress(id)))
  handle('git:push', (id, setUpstream, remote) => git.push(path(id), bool(setUpstream), progress(id), optionalStr(remote)))
  handle('git:fetchRemote', (id, remote) => git.fetchRemote(path(id), str(remote), progress(id)))
  handle('git:addRemote', (id, name, url) => git.addRemote(path(id), str(name), str(url)))
  handle('git:removeRemote', (id, name) => git.removeRemote(path(id), str(name)))
  handle('git:setRemoteUrl', (id, name, url) => git.setRemoteUrl(path(id), str(name), str(url)))
  handle('git:cancel', (id) => git.cancel(path(id)))

  handle('git:stashes', (id) => git.getStashes(path(id)))
  handle('git:stash', (id, o) => git.stash(path(id), { message: str(obj(o).message), includeUntracked: bool(obj(o).includeUntracked) }))
  handle('git:stashApply', (id, ref) => git.applyStash(path(id), str(ref)))
  handle('git:stashPop', (id, ref) => git.popStash(path(id), str(ref)))
  handle('git:stashDrop', (id, ref) => git.dropStash(path(id), str(ref)))
}
