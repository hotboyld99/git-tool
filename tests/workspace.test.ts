import { beforeEach, describe, expect, it } from 'vitest'
import { loadWorkspace, saveWorkspace } from '../src/renderer/utils/workspace'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v)
  }
})

const repo = (patch: Partial<Parameters<typeof saveWorkspace>[0]>): Parameters<typeof saveWorkspace>[0] => ({
  info: { path: '/repos/app' },
  selection: { type: 'changes' },
  selectedFile: null,
  historyFilter: { search: '', author: '', ref: '' },
  commitMessage: '',
  ...patch
})

describe('workspace session', () => {
  beforeEach(() => memory.clear())

  it('round-trips selection, open file, filters and the commit draft', () => {
    const state = {
      selection: { type: 'commit' as const, hash: 'abc123' },
      selectedFile: { source: 'commit' as const, hash: 'abc123', path: 'src/a.ts' },
      historyFilter: { search: 'login', author: 'ann', ref: 'dev' },
      commitMessage: 'wip: half written'
    }
    saveWorkspace(repo(state))
    expect(loadWorkspace('/repos/app')).toEqual(state)
    expect(loadWorkspace('/repos/other')).toEqual({})
  })

  it('ignores malformed data field by field', () => {
    memory.set('workspace:/repos/app', JSON.stringify({ selection: { type: 'bogus' }, historyFilter: { search: 1 }, commitMessage: 'kept', selectedFile: 5 }))
    expect(loadWorkspace('/repos/app')).toEqual({ commitMessage: 'kept' })
    memory.set('workspace:/repos/app', '{not json')
    expect(loadWorkspace('/repos/app')).toEqual({})
  })
})
