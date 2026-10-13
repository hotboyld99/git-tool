import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GitService } from '../src/main/services/git.service'
import { parseLfs, parseSubmodules, parseWorktrees } from '../src/main/git/extras'
import { tempRepo } from './helpers'

const git = new GitService()

describe('interactive rebase', () => {
  it('rewords (safely), squashes, fixes up, drops and reorders without opening an editor', async () => {
    const repo = tempRepo()
    const base = repo.commit('a.txt', 'a', 'init')
    const b = repo.commit('b.txt', 'b', 'add b')
    const c = repo.commit('c.txt', 'c', 'add c')
    const d = repo.commit('d.txt', 'd', 'add d')
    const e = repo.commit('e.txt', 'e', 'add e')

    const { commits, merges } = await git.rebaseCommits(repo.dir, base)
    expect(commits.map((x) => x.subject)).toEqual(['add b', 'add c', 'add d', 'add e'])
    expect(merges).toBe(0)

    const injected = join(repo.dir, 'pwned')
    await git.interactiveRebase(repo.dir, base, [
      { hash: e, action: 'pick' }, // moved first
      { hash: b, action: 'reword', message: `it's "b" $(touch ${injected})` },
      { hash: c, action: 'fixup' },
      { hash: d, action: 'drop' }
    ])

    const log = await git.getLog(repo.dir, { skip: 0, limit: 10 })
    expect(log.map((x) => x.subject)).toEqual([`it's "b" $(touch ${injected})`, 'add e', 'init'])
    expect(existsSync(injected)).toBe(false)
    expect((await git.getCommitFiles(repo.dir, log[0].hash)).map((f) => f.path)).toEqual(['b.txt', 'c.txt'])
    expect(existsSync(join(repo.dir, 'd.txt'))).toBe(false)
    expect((await git.status(repo.dir)).operation).toBeNull()

    // squash keeps both messages
    const base2 = log[0].hash
    const f = repo.commit('f.txt', 'f', 'add f')
    const g = repo.commit('g.txt', 'g', 'add g')
    await git.interactiveRebase(repo.dir, base2, [
      { hash: f, action: 'pick' },
      { hash: g, action: 'squash' }
    ])
    expect(await git.headMessage(repo.dir)).toBe('add f\n\nadd g')
  })

  it('lists commits parents-first even when they share a timestamp', async () => {
    const repo = tempRepo()
    const base = repo.commit('a.txt', 'a', 'init')
    const env = { ...process.env, GIT_AUTHOR_DATE: '1700000000 +0000', GIT_COMMITTER_DATE: '1700000000 +0000' }
    for (const name of ['one', 'two', 'three', 'four', 'five']) {
      execFileSync('git', ['commit', '-q', '--allow-empty', '-m', name], { cwd: repo.dir, env })
    }
    const { commits } = await git.rebaseCommits(repo.dir, base)
    expect(commits.map((c) => c.subject)).toEqual(['one', 'two', 'three', 'four', 'five'])
    commits.slice(1).forEach((c, i) => expect(c.parents).toEqual([commits[i].hash]))
  })

  it('refuses a base that is not an ancestor and invalid actions', async () => {
    const repo = tempRepo()
    const base = repo.commit('a.txt', 'a', 'init')
    repo.git('switch', '-q', '-c', 'side')
    const side = repo.commit('s.txt', 's', 'side')
    repo.git('switch', '-q', 'main')
    repo.commit('b.txt', 'b', 'main')
    await expect(git.rebaseCommits(repo.dir, side)).rejects.toThrow('not an ancestor')
    await expect(git.interactiveRebase(repo.dir, base, [{ hash: side, action: 'exec' as never }])).rejects.toThrow('Invalid rebase action')
  })
})

describe('bisect', () => {
  it('finds the first bad commit and resets', async () => {
    const repo = tempRepo()
    const hashes = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => repo.commit('state.txt', `${n} ${n >= 5 ? 'bad' : 'ok'}`, `commit ${n}`))
    let message = await git.bisectStart(repo.dir, hashes[7], hashes[0])
    expect((await git.status(repo.dir)).operation).toBe('bisect')
    for (let i = 0; i < 10 && !message.includes('is the first bad commit'); i++) {
      const state = readFileSync(join(repo.dir, 'state.txt'), 'utf8')
      message = await git.bisectMark(repo.dir, state.endsWith('bad') ? 'bad' : 'good')
    }
    expect(message).toContain(`${hashes[4]} is the first bad commit`)
    await git.abortOperation(repo.dir)
    expect((await git.status(repo.dir)).operation).toBeNull()
  })
})

describe('worktrees', () => {
  it('adds, lists and removes linked worktrees', async () => {
    const repo = tempRepo()
    repo.commit('a.txt', 'a', 'init')
    const path = `${repo.dir}-wt`
    await git.addWorktree(repo.dir, path, 'feature/wt', true)
    const list = await git.getWorktrees(repo.dir)
    expect(list.map((w) => [w.branch, w.isMain])).toEqual([
      ['main', true],
      ['feature/wt', false]
    ])
    expect(existsSync(join(path, 'a.txt'))).toBe(true)
    await expect(git.removeWorktree(repo.dir, list[0].path, true)).rejects.toThrow('Not a linked worktree')
    await git.removeWorktree(repo.dir, list[1].path, false)
    expect(await git.getWorktrees(repo.dir)).toHaveLength(1)
  })

  it('parses porcelain output', () => {
    const out = 'worktree /a\nHEAD 111\nbranch refs/heads/main\n\nworktree /b\nHEAD 222\ndetached\nlocked reason\nprunable gone\n'
    expect(parseWorktrees(out)).toEqual([
      { path: '/a', head: '111', branch: 'main', isMain: true, locked: false, prunable: false },
      { path: '/b', head: '222', branch: null, isMain: false, locked: true, prunable: true }
    ])
  })
})

describe('submodules', () => {
  it('lists and initializes submodules', async () => {
    const lib = tempRepo()
    lib.commit('lib.txt', 'lib', 'lib init')
    const repo = tempRepo()
    repo.commit('a.txt', 'a', 'init')
    // local file:// submodules are disabled by default since Git 2.38
    Object.assign(process.env, { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'protocol.file.allow', GIT_CONFIG_VALUE_0: 'always' })
    try {
      repo.git('submodule', '--quiet', 'add', lib.dir, 'libs/lib')
      repo.git('commit', '-q', '-m', 'add submodule')
      expect((await git.getSubmodules(repo.dir)).map((s) => [s.path, s.state])).toEqual([['libs/lib', 'ok']])
      repo.git('submodule', '--quiet', 'deinit', '-f', 'libs/lib')
      expect((await git.getSubmodules(repo.dir))[0].state).toBe('uninitialized')
      await git.updateSubmodules(repo.dir, () => {})
      expect((await git.getSubmodules(repo.dir))[0].state).toBe('ok')
    } finally {
      for (const k of ['GIT_CONFIG_COUNT', 'GIT_CONFIG_KEY_0', 'GIT_CONFIG_VALUE_0']) delete process.env[k]
    }
    expect(await git.getSubmodules(lib.dir)).toEqual([])
  })

  it('parses status lines', () => {
    expect(parseSubmodules(' abc123 libs/a (v1.0)\n-def456 libs/b\n+aaa111 c d (heads/main)\nUbbb222 e\n')).toEqual([
      { state: 'ok', hash: 'abc123', path: 'libs/a' },
      { state: 'uninitialized', hash: 'def456', path: 'libs/b' },
      { state: 'modified', hash: 'aaa111', path: 'c d' },
      { state: 'conflict', hash: 'bbb222', path: 'e' }
    ])
  })
})

describe('git lfs', () => {
  it('reports whether git-lfs is installed', async () => {
    const repo = tempRepo()
    const installed = (() => {
      try {
        execFileSync('git', ['lfs', 'version'], { stdio: 'ignore' })
        return true
      } catch {
        return false
      }
    })()
    expect((await git.getLfs(repo.dir)).installed).toBe(installed)
  })

  it('parses tracked patterns and files', () => {
    const track = 'Listing tracked patterns\n    *.psd (.gitattributes)\n    assets/** (assets/.gitattributes)\nListing excluded patterns\n'
    const files = 'abc123 * design.psd\ndef456 - assets/big file.bin\n'
    expect(parseLfs(track, files)).toEqual({
      patterns: ['*.psd', 'assets/**'],
      files: [
        { path: 'design.psd', downloaded: true },
        { path: 'assets/big file.bin', downloaded: false }
      ]
    })
  })
})

describe('git flow', () => {
  it('initializes, starts and finishes features and releases', async () => {
    const repo = tempRepo()
    repo.commit('a.txt', 'a', 'init')
    expect(await git.getGitFlow(repo.dir)).toBeNull()
    await expect(git.gitFlowStart(repo.dir, 'feature', 'x')).rejects.toThrow('not initialized')

    await git.gitFlowInit(repo.dir)
    expect(await git.getGitFlow(repo.dir)).toEqual({ main: 'main', develop: 'develop', feature: 'feature/', release: 'release/', hotfix: 'hotfix/', versionTag: '' })

    await git.gitFlowStart(repo.dir, 'feature', 'login')
    expect((await git.status(repo.dir)).branch).toBe('feature/login')
    repo.commit('login.txt', 'login', 'login')
    await git.gitFlowFinish(repo.dir, 'feature/login')
    expect((await git.status(repo.dir)).branch).toBe('develop')
    expect((await git.getBranches(repo.dir)).map((b) => b.name)).toEqual(['develop', 'main'])
    expect(existsSync(join(repo.dir, 'login.txt'))).toBe(true)

    await git.gitFlowStart(repo.dir, 'release', '1.0.0')
    repo.commit('version.txt', '1.0.0', 'bump version')
    await git.gitFlowFinish(repo.dir, 'release/1.0.0')
    const tags = await git.getTags(repo.dir)
    expect(tags.map((t) => [t.name, t.message])).toEqual([['1.0.0', 'Release 1.0.0']])
    const [mainHead] = await git.getLog(repo.dir, { skip: 0, limit: 1, ref: 'main' })
    expect(mainHead.parents).toHaveLength(2)
    expect(tags[0].hash).toBe(mainHead.hash)
    const [developHead] = await git.getLog(repo.dir, { skip: 0, limit: 1, ref: 'develop' })
    expect(developHead.subject).toBe("Merge branch 'release/1.0.0' into develop")
    await expect(git.gitFlowFinish(repo.dir, 'main')).rejects.toThrow('not a Git Flow')
  })
})
