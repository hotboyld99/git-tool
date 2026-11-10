import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GitService } from '../src/main/services/git.service'
import { GitCommandError } from '../src/main/git/executor'
import { tempRepo } from './helpers'

const git = new GitService()

describe('GitService (real repositories)', () => {
  it('stages, unstages and commits', async () => {
    const repo = tempRepo()
    repo.commit('a.txt', 'one\n', 'init')
    repo.write('a.txt', 'two\n')
    repo.write('new file.txt', 'x\n')

    let s = await git.status(repo.dir)
    expect(s.branch).toBe('main')
    expect(s.unstagedFiles.map((f) => [f.path, f.status])).toEqual([
      ['a.txt', 'modified'],
      ['new file.txt', 'untracked']
    ])

    const diff = await git.getDiff(repo.dir, { kind: 'working', path: 'a.txt', staged: false })
    expect(diff.hunks[0].lines.map((l) => l.type)).toEqual(['del', 'add'])
    const untracked = await git.getDiff(repo.dir, { kind: 'working', path: 'new file.txt', staged: false, untracked: true })
    expect(untracked.hunks[0].lines).toEqual([{ type: 'add', newNo: 1, content: 'x' }])

    await git.stage(repo.dir, ['a.txt'])
    s = await git.status(repo.dir)
    expect(s.stagedFiles.map((f) => f.path)).toEqual(['a.txt'])
    expect((await git.getDiff(repo.dir, { kind: 'working', path: 'a.txt', staged: true })).hunks).toHaveLength(1)

    await git.unstage(repo.dir, ['a.txt'])
    expect((await git.status(repo.dir)).stagedFiles).toEqual([])

    await git.stageAll(repo.dir)
    await git.commit(repo.dir, 'second "commit" $(echo injected)')
    s = await git.status(repo.dir)
    expect(s.stagedFiles.length + s.unstagedFiles.length).toBe(0)

    const [head] = await git.getLog(repo.dir, { skip: 0, limit: 1 })
    expect(head.subject).toBe('second "commit" $(echo injected)')
    expect(await git.getCommitFiles(repo.dir, head.hash)).toEqual([
      { path: 'a.txt', status: 'modified' },
      { path: 'new file.txt', status: 'added' }
    ])
    await expect(git.commit(repo.dir, '   ')).rejects.toThrow('must not be empty')
  })

  it('works in a repository without commits', async () => {
    const repo = tempRepo()
    expect(await git.getLog(repo.dir, { skip: 0, limit: 10 })).toEqual([])
    repo.write('a.txt', 'a')
    await git.stage(repo.dir, ['a.txt'])
    await git.unstage(repo.dir, ['a.txt'])
    const s = await git.status(repo.dir)
    expect(s.head).toBe('')
    expect(s.unstagedFiles.map((f) => f.status)).toEqual(['untracked'])
  })

  it('creates, checks out and deletes branches', async () => {
    const repo = tempRepo()
    repo.commit('a.txt', 'a', 'init')
    await git.createBranch(repo.dir, 'feature/x', null, true)
    expect((await git.status(repo.dir)).branch).toBe('feature/x')
    repo.commit('b.txt', 'b', 'on feature')
    await git.checkout(repo.dir, 'main')

    const branches = await git.getBranches(repo.dir)
    expect(branches.map((b) => [b.name, b.isCurrent])).toEqual([
      ['feature/x', false],
      ['main', true]
    ])

    // unmerged: plain delete is refused, force works
    const refused = await git.deleteBranch(repo.dir, 'feature/x', false).catch((e: unknown) => e)
    expect(refused).toBeInstanceOf(GitCommandError)
    expect((refused as GitCommandError).info.stderr).toMatch(/not fully merged/)
    await git.deleteBranch(repo.dir, 'feature/x', true)
    expect((await git.getBranches(repo.dir)).map((b) => b.name)).toEqual(['main'])

    await expect(git.checkout(repo.dir, '--orphan')).rejects.toThrow('Invalid ref name')
    await expect(git.createBranch(repo.dir, 'bad..name', null, false)).rejects.toThrow()
  })

  it('renames branches, including the current one', async () => {
    const repo = tempRepo()
    repo.commit('a.txt', 'a', 'init')
    await git.renameBranch(repo.dir, 'main', 'trunk')
    expect((await git.status(repo.dir)).branch).toBe('trunk')
    await expect(git.renameBranch(repo.dir, 'trunk', 'bad..name')).rejects.toThrow()
    expect((await git.getBranches(repo.dir)).map((b) => b.name)).toEqual(['trunk'])
  })

  it('always creates a merge commit, even when a fast-forward is possible', async () => {
    const repo = tempRepo()
    repo.commit('a.txt', 'a', 'init')
    repo.git('switch', '-q', '-c', 'feature')
    repo.commit('b.txt', 'b', 'on feature')
    repo.git('switch', '-q', 'main')
    await git.merge(repo.dir, 'feature')
    expect(repo.git('log', '-1', '--format=%P').trim().split(' ')).toHaveLength(2)
  })

  it('merges with conflicts and reports conflicted files', async () => {
    const repo = tempRepo()
    repo.commit('a.txt', 'base\n', 'init')
    repo.git('switch', '-q', '-c', 'other')
    repo.commit('a.txt', 'other\n', 'other change')
    repo.git('switch', '-q', 'main')
    repo.commit('a.txt', 'main\n', 'main change')
    await expect(git.merge(repo.dir, 'other')).rejects.toBeInstanceOf(GitCommandError)
    const s = await git.status(repo.dir)
    expect(s.conflictedFiles.map((f) => f.path)).toEqual(['a.txt'])
  })

  it('stashes and pops', async () => {
    const repo = tempRepo()
    repo.commit('a.txt', 'a', 'init')
    repo.write('a.txt', 'changed')
    repo.write('u.txt', 'untracked')
    await git.stash(repo.dir, { message: 'my stash', includeUntracked: true })
    expect((await git.status(repo.dir)).unstagedFiles).toEqual([])

    const [stash] = await git.getStashes(repo.dir)
    expect(stash).toMatchObject({ ref: 'stash@{0}', branch: 'main', message: 'my stash' })
    expect(await git.getCommitFiles(repo.dir, stash.hash)).toEqual([{ path: 'a.txt', status: 'modified' }])

    await git.popStash(repo.dir, stash.ref)
    expect(readFileSync(join(repo.dir, 'u.txt'), 'utf8')).toBe('untracked')
    expect(await git.getStashes(repo.dir)).toEqual([])
    await expect(git.dropStash(repo.dir, 'stash@{0}; rm -rf /')).rejects.toThrow('Invalid stash')
  })

  it('discards tracked changes and deletes untracked files', async () => {
    const repo = tempRepo()
    repo.commit('a.txt', 'a', 'init')
    repo.write('a.txt', 'changed')
    repo.write('u.txt', 'u')
    await git.discard(repo.dir, ['a.txt'])
    await git.deleteUntracked(repo.dir, ['u.txt'])
    expect(readFileSync(join(repo.dir, 'a.txt'), 'utf8')).toBe('a')
    expect((await git.status(repo.dir)).unstagedFiles).toEqual([])
  })

  it('pushes to a local bare remote and detects a missing upstream', async () => {
    const remote = tempRepo()
    remote.git('init', '-q', '--bare', '-b', 'main', 'remote.git')
    const repo = tempRepo()
    repo.commit('a.txt', 'a', 'init')
    repo.git('remote', 'add', 'origin', join(remote.dir, 'remote.git'))

    const progress: string[] = []
    const noUpstream = await git.push(repo.dir, false, (t) => progress.push(t)).catch((e: unknown) => e)
    expect((noUpstream as GitCommandError).info.stderr).toMatch(/has no upstream branch/)

    await git.push(repo.dir, true, (t) => progress.push(t))
    const s = await git.status(repo.dir)
    expect(s.upstream).toBe('origin/main')
    expect((await git.getRemotes(repo.dir))[0].name).toBe('origin')

    await git.fetch(repo.dir, () => {})
    await git.pull(repo.dir, () => {})
    expect((await git.getBranches(repo.dir)).map((b) => b.name)).toEqual(['main', 'origin/main'])
  })
})
