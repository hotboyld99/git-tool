import { describe, expect, it } from 'vitest'
import { parseStatus } from '../src/main/git/status'
import { parseBranches } from '../src/main/git/branch'
import { parseLog, parseRefs } from '../src/main/git/log'
import { parseStashes } from '../src/main/git/stash'
import { parseRemotes } from '../src/main/git/remote'
import { parseNameStatus } from '../src/main/git/commit'
import { parseDiff } from '../src/main/git/diff'
import { changeScope } from '../src/main/services/filesystem.service'
import { splitRows } from '../src/renderer/utils/diff'
import { errorSummary } from '../src/renderer/utils/format'

describe('parseStatus', () => {
  it('parses branch info and every entry type', () => {
    const out = [
      '# branch.oid 1234abcd',
      '# branch.head main',
      '# branch.upstream origin/main',
      '# branch.ab +2 -1',
      '1 M. N... 100644 100644 100644 aaa bbb src/a file.ts',
      '1 .D N... 100644 100644 000000 aaa bbb gone.ts',
      '1 MM N... 100644 100644 100644 aaa bbb both.ts',
      '2 R. N... 100644 100644 100644 aaa bbb R100 new name.ts',
      'old name.ts',
      'u UU N... 100644 100644 100644 100644 a b c conflict.ts',
      '? untracked file.txt',
      ''
    ].join('\0')
    const s = parseStatus(out)
    expect(s).toMatchObject({ branch: 'main', head: '1234abcd', upstream: 'origin/main', ahead: 2, behind: 1 })
    expect(s.stagedFiles).toEqual([
      { path: 'src/a file.ts', originalPath: undefined, status: 'modified', staged: true },
      { path: 'both.ts', originalPath: undefined, status: 'modified', staged: true },
      { path: 'new name.ts', originalPath: 'old name.ts', status: 'renamed', staged: true }
    ])
    expect(s.unstagedFiles).toEqual([
      { path: 'gone.ts', status: 'deleted', staged: false },
      { path: 'both.ts', status: 'modified', staged: false },
      { path: 'untracked file.txt', status: 'untracked', staged: false }
    ])
    expect(s.conflictedFiles).toEqual([{ path: 'conflict.ts', status: 'conflicted', staged: false }])
  })

  it('handles detached HEAD and repositories without commits', () => {
    expect(parseStatus('# branch.oid abc\0# branch.head (detached)\0').branch).toBeNull()
    expect(parseStatus('# branch.oid (initial)\0# branch.head main\0').head).toBe('')
  })
})

describe('parseBranches', () => {
  it('parses local/remote branches and skips symbolic refs', () => {
    const line = (...f: string[]): string => f.join('\0')
    const out = [
      line('refs/heads/main', 'main', 'h1', '*', 'origin/main', 'ahead 1', ''),
      line('refs/heads/feature/x', 'feature/x', 'h2', ' ', '', '', ''),
      line('refs/remotes/origin/HEAD', 'origin/HEAD', 'h1', ' ', '', '', 'refs/remotes/origin/main'),
      line('refs/remotes/origin/main', 'origin/main', 'h1', ' ', '', '', ''),
      ''
    ].join('\n')
    expect(parseBranches(out)).toEqual([
      { name: 'main', hash: 'h1', isRemote: false, remote: undefined, isCurrent: true, upstream: 'origin/main', track: 'ahead 1' },
      { name: 'feature/x', hash: 'h2', isRemote: false, remote: undefined, isCurrent: false, upstream: undefined, track: undefined },
      { name: 'origin/main', hash: 'h1', isRemote: true, remote: 'origin', isCurrent: false, upstream: undefined, track: undefined }
    ])
  })
})

describe('parseLog', () => {
  it('parses NUL separated records, including multi-line bodies', () => {
    const rec = (...f: string[]): string => f.join('\0') + '\0'
    const out =
      rec('h2', 's2', 'h1 h0', 'Ann', 'ann@x', '2026-01-02T00:00:00+00:00', 'Merge it', 'line 1\nline 2\n', 'HEAD -> main, origin/main, origin/HEAD, tag: v1') +
      rec('h1', 's1', '', 'Bob', 'bob@x', '2026-01-01T00:00:00+00:00', 'init', '', '')
    const commits = parseLog(out)
    expect(commits).toHaveLength(2)
    expect(commits[0]).toMatchObject({ hash: 'h2', parents: ['h1', 'h0'], body: 'line 1\nline 2', refs: ['HEAD', 'main', 'origin/main', 'tag: v1'] })
    expect(commits[1]).toMatchObject({ hash: 'h1', parents: [], body: undefined, refs: [] })
  })

  it('parses decorations', () => {
    expect(parseRefs('')).toEqual([])
    expect(parseRefs('HEAD')).toEqual(['HEAD'])
  })
})

describe('other parsers', () => {
  it('parses stashes', () => {
    const out = 'stash@{0}\0aaa\0On main: my work\0stash@{1}\0bbb\0WIP on feature/x: 123abc subject\0'
    expect(parseStashes(out)).toEqual([
      { index: 0, ref: 'stash@{0}', hash: 'aaa', branch: 'main', message: 'my work' },
      { index: 1, ref: 'stash@{1}', hash: 'bbb', branch: 'feature/x', message: '123abc subject' }
    ])
  })

  it('parses remotes', () => {
    const out = 'origin\tgit@github.com:a/b.git (fetch)\norigin\thttps://x/b.git (push)\n'
    expect(parseRemotes(out)).toEqual([{ name: 'origin', fetchUrl: 'git@github.com:a/b.git', pushUrl: 'https://x/b.git' }])
  })

  it('parses name-status', () => {
    expect(parseNameStatus('M\0a.ts\0R087\0old.ts\0new.ts\0A\0b c.ts\0D\0d.ts\0')).toEqual([
      { path: 'a.ts', status: 'modified' },
      { originalPath: 'old.ts', path: 'new.ts', status: 'renamed' },
      { path: 'b c.ts', status: 'added' },
      { path: 'd.ts', status: 'deleted' }
    ])
  })

  it('parses a unified diff with line numbers', () => {
    const raw = ['diff --git a/f b/f', '--- a/f', '+++ b/f', '@@ -1,3 +1,3 @@ fn', ' a', '-b', '+B', ' c', '\\ No newline at end of file', ''].join('\n')
    const diff = parseDiff(raw)
    expect(diff.binary).toBe(false)
    expect(diff.hunks[0].lines).toEqual([
      { type: 'context', oldNo: 1, newNo: 1, content: 'a' },
      { type: 'del', oldNo: 2, content: 'b' },
      { type: 'add', newNo: 2, content: 'B' },
      { type: 'context', oldNo: 3, newNo: 3, content: 'c' },
      { type: 'meta', content: '\\ No newline at end of file' }
    ])
    expect(splitRows(diff.hunks).filter((r) => r.kind === 'pair')).toHaveLength(4)
    expect(parseDiff('diff --git a/x b/x\nBinary files a/x and b/x differ\n').binary).toBe(true)
  })

  it('classifies watcher paths', () => {
    expect(changeScope('src/a.ts')).toBe('worktree')
    expect(changeScope('.gitignore')).toBe('worktree')
    expect(changeScope('.git/index')).toBe('worktree')
    expect(changeScope('.git/HEAD')).toBe('refs')
    expect(changeScope('.git/refs/heads/main')).toBe('refs')
    expect(changeScope('.git/objects/ab/cdef')).toBeNull()
    expect(changeScope('.git/index.lock')).toBeNull()
  })
})

describe('errorSummary', () => {
  it('picks the error line, also after carriage-return progress output', () => {
    expect(errorSummary('Rebasing (1/1)\rerror: could not apply c7589e5... msg\nhint: resolve\nCONFLICT (add/add): x')).toBe('could not apply c7589e5... msg')
    expect(errorSummary('To origin\n ! [rejected]        main -> main (fetch first)\nhint: pull first')).toBe('! [rejected]        main -> main (fetch first)')
    expect(errorSummary('fatal: not a git repository')).toBe('not a git repository')
  })
})
