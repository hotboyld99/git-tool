import { describe, expect, it } from 'vitest'
import type { GitCommit } from '../src/shared/types'
import { computeGraph } from '../src/renderer/utils/graph'
import { GitService } from '../src/main/services/git.service'
import { tempRepo } from './helpers'

const c = (hash: string, parents: string[], refs: string[] = []): GitCommit => ({
  hash,
  shortHash: hash,
  parents,
  authorName: '',
  authorEmail: '',
  date: '',
  subject: hash,
  refs
})

describe('computeGraph', () => {
  it('keeps a linear history in one lane', () => {
    const g = computeGraph([c('c', ['b']), c('b', ['a']), c('a', [])])
    expect(g.nodes.map((n) => n.lane)).toEqual([0, 0, 0])
    expect(g.width).toBe(1)
  })

  it('opens a lane for two branch tips and joins them at the fork point', () => {
    const g = computeGraph([c('x', ['a'], ['feature']), c('y', ['a'], ['main']), c('a', [])])
    expect(g.nodes.map((n) => n.lane)).toEqual([0, 1, 0])
    expect(g.nodes[2].edges).toContainEqual(expect.objectContaining({ fromLane: 1, toLane: 0, type: 'branch', part: 'top' }))
    expect(g.width).toBe(2)
  })

  it('handles octopus merges', () => {
    const g = computeGraph([c('m', ['a', 'b', 'd']), c('d', ['a']), c('b', ['a']), c('a', [])])
    expect(g.nodes[0].edges.filter((e) => e.type === 'merge').map((e) => e.toLane)).toEqual([1, 2])
    expect(g.nodes[3].lane).toBe(0)
    expect(g.width).toBe(3)
  })
})

describe('graph of a real repository', () => {
  it('main + feature branch merged back', async () => {
    const repo = tempRepo()
    const a = repo.commit('a.txt', 'a', 'initial commit')
    repo.git('switch', '-q', '-c', 'feature')
    const f1 = repo.commit('f.txt', '1', 'feature 1')
    const f2 = repo.commit('f.txt', '2', 'feature 2')
    repo.git('switch', '-q', 'main')
    const m1 = repo.commit('m.txt', 'm', 'main commit')
    repo.git('merge', '-q', '--no-edit', 'feature')
    const merge = repo.git('rev-parse', 'HEAD').trim()

    const commits = await new GitService().getLog(repo.dir, { skip: 0, limit: 100 })
    expect(commits.map((x) => x.hash)).toEqual([merge, m1, f2, f1, a])
    expect(commits[0].parents).toEqual([m1, f2])
    expect(commits[0].refs).toEqual(['HEAD', 'main'])
    expect(commits[2].refs).toEqual(['feature'])

    const g = computeGraph(commits)
    expect(g.nodes.map((n) => n.lane)).toEqual([0, 0, 1, 1, 0])
    expect(g.nodes[0].isMerge).toBe(true)
    expect(g.nodes[0].edges).toContainEqual(expect.objectContaining({ fromLane: 0, toLane: 1, type: 'merge' }))
    // main commit: feature lane passes straight through
    expect(g.nodes[1].edges).toContainEqual(expect.objectContaining({ fromLane: 1, toLane: 1, part: 'full' }))
    // initial commit: the feature lane joins back
    expect(g.nodes[4].edges).toContainEqual(expect.objectContaining({ fromLane: 1, toLane: 0, type: 'branch' }))
    expect(g.width).toBe(2)
  })
})
