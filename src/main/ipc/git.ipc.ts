import type { DiffRequest, ProgressEvent } from '../../shared/types'
import type { GitService } from '../services/git.service'
import type { RepositoryService } from '../services/repository.service'
import { bool, handle, int, obj, str, strs } from './handle'

function diffRequest(v: unknown): DiffRequest {
  const r = obj(v)
  const ignoreWhitespace = bool(r.ignoreWhitespace)
  if (r.kind === 'commit') return { kind: 'commit', hash: str(r.hash), path: str(r.path), ignoreWhitespace }
  return { kind: 'working', path: str(r.path), staged: bool(r.staged), untracked: bool(r.untracked), ignoreWhitespace }
}

export function registerGitIpc(repos: RepositoryService, git: GitService, sendProgress: (event: ProgressEvent) => void): void {
  const path = (id: unknown): string => repos.get(id).path
  const progress = (id: unknown) => (text: string) => sendProgress({ repoId: str(id), text })

  handle('git:status', (id) => git.status(path(id)))
  handle('git:branches', (id) => git.getBranches(path(id)))
  handle('git:remotes', (id) => git.getRemotes(path(id)))
  handle('git:log', (id, o) => git.getLog(path(id), { skip: int(obj(o).skip, 0, 1e9), limit: int(obj(o).limit, 1, 5000) }))
  handle('git:diff', (id, req) => git.getDiff(path(id), diffRequest(req)))
  handle('git:commitFiles', (id, hash) => git.getCommitFiles(path(id), str(hash)))

  handle('git:stage', (id, files) => git.stage(path(id), strs(files)))
  handle('git:stageAll', (id) => git.stageAll(path(id)))
  handle('git:unstage', (id, files) => git.unstage(path(id), strs(files)))
  handle('git:unstageAll', (id) => git.unstageAll(path(id)))
  handle('git:discard', (id, files) => git.discard(path(id), strs(files)))
  handle('git:deleteUntracked', (id, files) => git.deleteUntracked(path(id), strs(files)))
  handle('git:commit', (id, message) => git.commit(path(id), str(message)))

  handle('git:checkout', (id, branch) => git.checkout(path(id), str(branch)))
  handle('git:checkoutRemote', (id, branch) => git.checkoutRemote(path(id), str(branch)))
  handle('git:checkoutCommit', (id, hash) => git.checkoutCommit(path(id), str(hash)))
  handle('git:createBranch', (id, name, start, checkout) =>
    git.createBranch(path(id), str(name), start === null ? null : str(start), bool(checkout))
  )
  handle('git:deleteBranch', (id, name, force) => git.deleteBranch(path(id), str(name), bool(force)))
  handle('git:merge', (id, branch) => git.merge(path(id), str(branch)))

  handle('git:fetch', (id) => git.fetch(path(id), progress(id)))
  handle('git:pull', (id) => git.pull(path(id), progress(id)))
  handle('git:push', (id, setUpstream) => git.push(path(id), bool(setUpstream), progress(id)))
  handle('git:cancel', (id) => git.cancel(path(id)))

  handle('git:stashes', (id) => git.getStashes(path(id)))
  handle('git:stash', (id, o) => git.stash(path(id), { message: str(obj(o).message), includeUntracked: bool(obj(o).includeUntracked) }))
  handle('git:stashApply', (id, ref) => git.applyStash(path(id), str(ref)))
  handle('git:stashPop', (id, ref) => git.popStash(path(id), str(ref)))
  handle('git:stashDrop', (id, ref) => git.dropStash(path(id), str(ref)))
}
