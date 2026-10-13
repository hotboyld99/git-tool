import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// isolate tests from the developer's ~/.gitconfig (signing, hooks, default branch...)
const emptyConfig = join(mkdtempSync(join(tmpdir(), 'git-tool-cfg-')), 'gitconfig')
writeFileSync(emptyConfig, '')
// no editor configured: commands that would open one must not be reached (they would hang)
for (const key of ['GIT_EDITOR', 'EDITOR', 'VISUAL', 'GIT_SEQUENCE_EDITOR']) delete process.env[key]
Object.assign(process.env, {
  GIT_CONFIG_GLOBAL: emptyConfig,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Tester',
  GIT_AUTHOR_EMAIL: 'tester@example.com',
  GIT_COMMITTER_NAME: 'Tester',
  GIT_COMMITTER_EMAIL: 'tester@example.com'
})

let clock = 1_700_000_000

/** Temporary repository with deterministic, strictly increasing commit dates. */
export function tempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'git-tool-test-'))
  const git = (...args: string[]): string => {
    clock += 60
    const date = `${clock} +0000`
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } })
  }
  git('init', '-q', '-b', 'main')
  const write = (file: string, content: string): void => writeFileSync(join(dir, file), content)
  const commit = (file: string, content: string, message: string): string => {
    write(file, content)
    git('add', file)
    git('commit', '-q', '-m', message)
    return git('rev-parse', 'HEAD').trim()
  }
  return { dir, git, write, commit }
}
