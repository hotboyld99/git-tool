import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GitService } from '../src/main/services/git.service'
import { runGit } from '../src/main/git/executor'
import { parseBlame } from '../src/main/git/blame'
import { tempRepo } from './helpers'

const git = new GitService()

describe('blame', () => {
  it('parses porcelain output, reusing commit headers', () => {
    const h1 = 'a'.repeat(40)
    const h2 = 'b'.repeat(40)
    const out = [
      `${h1} 1 1 2`,
      'author Ann',
      'author-time 1700000000',
      'summary first',
      'filename f.ts',
      '\tline one',
      `${h1} 2 2`,
      '\tline two',
      `${h2} 3 3 1`,
      'author Bob',
      'author-time 1700000060',
      'summary second',
      'filename f.ts',
      '\tline three',
      ''
    ].join('\n')
    const blame = parseBlame(out)
    expect(blame.lines.map((l) => [l.hash[0], l.line, l.content])).toEqual([
      ['a', 1, 'line one'],
      ['a', 2, 'line two'],
      ['b', 3, 'line three']
    ])
    expect(blame.commits[h2]).toEqual({ hash: h2, author: 'Bob', date: '2023-11-14T22:14:20.000Z', summary: 'second' })
  })

  it('blames the working tree and a given commit', async () => {
    const repo = tempRepo()
    const first = repo.commit('f.txt', 'one\n', 'first')
    repo.commit('f.txt', 'one\ntwo\n', 'second')
    repo.write('f.txt', 'one\ntwo\nthree\n')
    const now = await git.blame(repo.dir, 'f.txt', null)
    expect(now.lines.map((l) => now.commits[l.hash].summary)).toEqual(['first', 'second', 'Version of f.txt from f.txt'])
    expect(now.lines[2].hash).toMatch(/^0+$/)
    const old = await git.blame(repo.dir, 'f.txt', first)
    expect(old.lines.map((l) => l.content)).toEqual(['one'])
  })
})

describe('amend', () => {
  it('rewrites the last commit message and content', async () => {
    const repo = tempRepo()
    repo.commit('a.txt', 'a', 'init')
    repo.commit('a.txt', 'b', 'tpyo\n\nbody')
    expect(await git.headMessage(repo.dir)).toBe('tpyo\n\nbody')
    repo.write('b.txt', 'b')
    await git.stage(repo.dir, ['b.txt'])
    await git.commit(repo.dir, 'typo fixed', true)
    const commits = await git.getLog(repo.dir, { skip: 0, limit: 10 })
    expect(commits.map((c) => c.subject)).toEqual(['typo fixed', 'init'])
    expect((await git.getCommitFiles(repo.dir, commits[0].hash)).map((f) => f.path)).toEqual(['a.txt', 'b.txt'])
  })
})

describe('rebase', () => {
  it('stops on conflicts, continues without an editor, and can be aborted', async () => {
    const repo = tempRepo()
    repo.commit('a.txt', 'base\n', 'init')
    repo.git('switch', '-q', '-c', 'feature')
    repo.commit('a.txt', 'feature\n', 'feature change')
    repo.commit('b.txt', 'b\n', 'feature extra')
    repo.git('switch', '-q', 'main')
    repo.commit('a.txt', 'main\n', 'main change')
    repo.git('switch', '-q', 'feature')

    await expect(git.rebase(repo.dir, 'main')).rejects.toThrow()
    let s = await git.status(repo.dir)
    expect(s.operation).toBe('rebase')
    expect(s.conflictedFiles.map((f) => f.path)).toEqual(['a.txt'])

    // during a rebase "theirs" is the commit being replayed
    await git.resolveConflict(repo.dir, ['a.txt'], 'theirs')
    await git.rebaseContinue(repo.dir)
    s = await git.status(repo.dir)
    expect(s.operation).toBeNull()
    expect(s.branch).toBe('feature')
    const log = await git.getLog(repo.dir, { skip: 0, limit: 10, ref: 'feature' })
    expect(log.map((c) => c.subject)).toEqual(['feature extra', 'feature change', 'main change', 'init'])
    expect(log.every((c) => c.parents.length <= 1)).toBe(true)
    expect(readFileSync(join(repo.dir, 'a.txt'), 'utf8')).toBe('feature\n')

    // abort restores the branch
    repo.git('switch', '-q', 'main')
    repo.commit('a.txt', 'main again\n', 'main change 2')
    repo.git('switch', '-q', 'feature')
    const before = repo.git('rev-parse', 'HEAD').trim()
    await expect(git.rebase(repo.dir, 'main')).rejects.toThrow()
    await git.abortOperation(repo.dir)
    expect(repo.git('rev-parse', 'HEAD').trim()).toBe(before)

    // skip drops the conflicting commit
    await expect(git.rebase(repo.dir, 'main')).rejects.toThrow()
    await git.rebaseSkip(repo.dir)
    expect((await git.status(repo.dir)).operation).toBeNull()
  })
})

describe('remotes', () => {
  it('adds, edits, fetches, pushes to and removes remotes', async () => {
    const server = tempRepo()
    server.git('init', '-q', '--bare', '-b', 'main', 'one.git')
    server.git('init', '-q', '--bare', '-b', 'main', 'two.git')
    const repo = tempRepo()
    repo.commit('a.txt', 'a', 'init')

    await git.addRemote(repo.dir, 'upstream', join(server.dir, 'wrong.git'))
    await git.setRemoteUrl(repo.dir, 'upstream', join(server.dir, 'one.git'))
    await git.addRemote(repo.dir, 'backup', join(server.dir, 'two.git'))
    expect((await git.getRemotes(repo.dir)).map((r) => [r.name, r.fetchUrl.endsWith('one.git') || r.fetchUrl.endsWith('two.git')])).toEqual([
      ['backup', true],
      ['upstream', true]
    ])

    await git.push(repo.dir, true, () => {}, 'backup')
    expect((await git.status(repo.dir)).upstream).toBe('backup/main')
    await git.fetchRemote(repo.dir, 'upstream', () => {})

    await git.removeRemote(repo.dir, 'backup')
    expect((await git.getRemotes(repo.dir)).map((r) => r.name)).toEqual(['upstream'])
    await expect(git.addRemote(repo.dir, 'x', '--upload-pack=evil')).rejects.toThrow('Invalid remote URL')
    await expect(git.addRemote(repo.dir, '-x', 'url')).rejects.toThrow('Invalid ref name')
  })
})

describe('custom git executable', () => {
  it('reports a missing executable clearly', async () => {
    await expect(runGit(process.cwd(), ['--version'], { executable: '/nonexistent/git' })).rejects.toThrow('Git executable not found')
    expect(await runGit(process.cwd(), ['--version'])).toMatch(/^git version/)
  })
})
