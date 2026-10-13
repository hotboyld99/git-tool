import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GitService } from '../src/main/services/git.service'
import { tempRepo } from './helpers'

const git = new GitService()

/** main and `other` both change a.txt -> merging/cherry-picking conflicts */
function conflictingRepo() {
  const repo = tempRepo()
  repo.commit('a.txt', 'base\n', 'init')
  repo.git('switch', '-q', '-c', 'other')
  const theirs = repo.commit('a.txt', 'theirs\n', 'their change')
  repo.git('switch', '-q', 'main')
  repo.commit('a.txt', 'ours\n', 'our change')
  return { ...repo, theirs }
}

describe('conflicts', () => {
  it('detects a merge in progress, prepares its message and aborts it', async () => {
    const repo = conflictingRepo()
    await expect(git.merge(repo.dir, 'other')).rejects.toThrow()
    const s = await git.status(repo.dir)
    expect(s.operation).toBe('merge')
    expect(s.mergeMessage).toMatch(/^Merge branch 'other'/)
    expect(s.conflictedFiles.map((f) => f.path)).toEqual(['a.txt'])
    const diff = await git.getDiff(repo.dir, { kind: 'working', path: 'a.txt', staged: false, conflicted: true })
    expect(diff.hunks[0].lines.some((l) => l.content.startsWith('<<<<<<<'))).toBe(true)

    await git.abortOperation(repo.dir)
    const after = await git.status(repo.dir)
    expect(after.operation).toBeNull()
    expect(after.conflictedFiles).toEqual([])
  })

  it('resolves with theirs/ours and finishes the merge with a commit', async () => {
    const repo = conflictingRepo()
    await expect(git.merge(repo.dir, 'other')).rejects.toThrow()
    await git.resolveConflict(repo.dir, ['a.txt'], 'theirs')
    expect(readFileSync(join(repo.dir, 'a.txt'), 'utf8')).toBe('theirs\n')
    const s = await git.status(repo.dir)
    expect(s.conflictedFiles).toEqual([])
    await git.commit(repo.dir, s.mergeMessage ?? 'merge')
    const [merge] = await git.getLog(repo.dir, { skip: 0, limit: 1 })
    expect(merge.parents).toHaveLength(2)
    expect((await git.status(repo.dir)).operation).toBeNull()
    await expect(git.abortOperation(repo.dir)).rejects.toThrow('No merge')
  })

  it('stops a conflicting cherry-pick and resolves with ours', async () => {
    const repo = conflictingRepo()
    await expect(git.cherryPick(repo.dir, repo.theirs)).rejects.toThrow()
    expect((await git.status(repo.dir)).operation).toBe('cherry-pick')
    await git.resolveConflict(repo.dir, ['a.txt'], 'ours')
    expect(readFileSync(join(repo.dir, 'a.txt'), 'utf8')).toBe('ours\n')
    await git.abortOperation(repo.dir)
  })
})

describe('history operations', () => {
  it('cherry-picks, reverts (also merge commits) and resets', async () => {
    const repo = tempRepo()
    repo.commit('a.txt', 'a', 'init')
    repo.git('switch', '-q', '-c', 'feature')
    const picked = repo.commit('b.txt', 'b', 'add b')
    repo.git('switch', '-q', 'main')

    await git.cherryPick(repo.dir, picked)
    let [head] = await git.getLog(repo.dir, { skip: 0, limit: 1, ref: 'main' })
    expect(head.subject).toBe('add b')
    const cherryPicked = head.hash

    await git.revert(repo.dir, head.hash)
    ;[head] = await git.getLog(repo.dir, { skip: 0, limit: 1, ref: 'main' })
    expect(head.subject).toBe('Revert "add b"')

    repo.git('merge', '-q', '--no-ff', '--no-edit', 'feature')
    const merge = repo.git('rev-parse', 'HEAD').trim()
    await git.revert(repo.dir, merge) // needs -m 1
    ;[head] = await git.getLog(repo.dir, { skip: 0, limit: 1, ref: 'main' })
    expect(head.subject).toMatch(/^Revert "Merge branch 'feature'/)

    // HEAD's tree has no b.txt; soft reset to the cherry-pick keeps that tree -> b.txt deletion staged
    await git.reset(repo.dir, cherryPicked, 'soft')
    let s = await git.status(repo.dir)
    expect(s.head).toBe(cherryPicked)
    expect(s.stagedFiles).toEqual([{ path: 'b.txt', originalPath: undefined, status: 'deleted', staged: true }])
    await git.reset(repo.dir, cherryPicked, 'hard')
    s = await git.status(repo.dir)
    expect(s.stagedFiles.length + s.unstagedFiles.length).toBe(0)
    await expect(git.reset(repo.dir, cherryPicked, 'keep' as never)).rejects.toThrow('Invalid reset mode')
  })

  it('creates, lists and deletes lightweight and annotated tags', async () => {
    const repo = tempRepo()
    const first = repo.commit('a.txt', 'a', 'init')
    const second = repo.commit('a.txt', 'b', 'second')
    await git.createTag(repo.dir, 'v1', first, '')
    await git.createTag(repo.dir, 'v2', second, 'Release 2')
    const tags = await git.getTags(repo.dir)
    expect(tags).toEqual(
      expect.arrayContaining([
        { name: 'v1', hash: first, message: undefined },
        { name: 'v2', hash: second, message: 'Release 2' }
      ])
    )
    await expect(git.createTag(repo.dir, 'bad..tag', first, '')).rejects.toThrow('not a valid tag name')
    await git.deleteTag(repo.dir, 'v1')
    expect((await git.getTags(repo.dir)).map((t) => t.name)).toEqual(['v2'])
  })

  it('filters history by message, hash, author and branch', async () => {
    const repo = tempRepo()
    repo.commit('a.txt', 'a', 'init')
    repo.git('switch', '-q', '-c', 'feature')
    const fix = repo.commit('b.txt', 'b', 'Fix login bug')
    repo.git('switch', '-q', 'main')
    repo.git('-c', 'user.name=Alice', '-c', 'user.email=alice@x', 'commit', '-q', '--allow-empty', '--author=Alice <alice@x>', '-m', 'alice work')

    const subjects = async (o: object) => (await git.getLog(repo.dir, { skip: 0, limit: 50, ...o })).map((c) => c.subject)
    expect(await subjects({ search: 'LOGIN' })).toEqual(['Fix login bug'])
    expect(await subjects({ search: 'login.*' })).toEqual([]) // literal, not a regex
    expect(await subjects({ search: fix.slice(0, 8) })).toEqual(['Fix login bug'])
    expect(await subjects({ author: 'alice' })).toEqual(['alice work'])
    expect(await subjects({ ref: 'feature' })).toEqual(['Fix login bug', 'init'])
    await expect(git.getLog(repo.dir, { skip: 0, limit: 5, ref: '--all' })).rejects.toThrow('Invalid ref')
  })
})
