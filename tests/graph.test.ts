import { describe, expect, it } from 'vitest'
import type { GitCommit } from '../src/shared/types'
import { computeGraph, flatGraph, graphRows } from '../src/renderer/utils/graph'
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

describe('graphRows', () => {
  const stash = { index: 0, ref: 'stash@{0}', hash: 's', base: 'a', branch: 'main', message: 'saved' }

  it('puts WIP on top of HEAD and a stash above its base, all in the graph', () => {
    const rows = graphRows([c('b', ['a'], ['HEAD', 'main']), c('a', [])], 'b', 2, [stash])
    expect(rows.map((r) => r.kind)).toEqual(['wip', 'commit', 'stash', 'commit'])
    const g = computeGraph(rows.map((r) => r.commit))
    // WIP continues into HEAD's lane, the stash branches off into its own lane and joins at its base
    expect(g.nodes.map((n) => n.lane)).toEqual([0, 0, 1, 0])
  })

  it('skips pseudo rows whose base is not loaded or when clean', () => {
    expect(graphRows([c('b', ['a'])], 'zzz', 2, [stash]).map((r) => r.kind)).toEqual(['commit'])
    expect(graphRows([c('b', ['a'])], 'b', 0, []).map((r) => r.kind)).toEqual(['commit'])
  })
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

describe('graph performance', () => {
  it('lays out 50k commits with a merge every 4 commits quickly', () => {
    // newest first: merge_i (main_i + feature_i) <- both fork from base_i <- base_i continues to merge_{i+1}
    const commits: GitCommit[] = []
    const rounds = 12_500
    for (let i = 0; i < rounds; i++) {
      commits.push(c(`merge${i}`, [`main${i}`, `feature${i}`]), c(`main${i}`, [`base${i}`]), c(`feature${i}`, [`base${i}`]))
      commits.push(c(`base${i}`, i + 1 < rounds ? [`merge${i + 1}`] : []))
    }
    const started = performance.now()
    const g = computeGraph(commits)
    expect(performance.now() - started).toBeLessThan(1500)
    expect(g.nodes).toHaveLength(commits.length)
    expect(g.width).toBe(2)
  })

  it('draws filtered results without lanes', () => {
    const g = flatGraph([c('b', ['a']), c('x', ['y', 'z'])])
    expect(g.nodes.map((n) => [n.lane, n.edges.length, n.isMerge])).toEqual([
      [0, 0, false],
      [0, 0, true]
    ])
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
