import { describe, expect, it } from 'vitest'
import { buildBranchTree, someLeaf } from '../src/renderer/utils/branchTree'

describe('buildBranchTree', () => {
  it('groups by "/" prefixes, nested, folders first and sorted', () => {
    const names = ['main', 'feature/search', 'fixbug/DSCB_02', 'feature/ui/dark-mode', 'dev', 'feature/auth']
    const tree = buildBranchTree(names, (n) => n)

    expect(tree.leaves.map((l) => l.name)).toEqual(['dev', 'main'])
    expect(tree.folders.map((f) => [f.name, f.path, f.count])).toEqual([
      ['feature', 'feature', 3],
      ['fixbug', 'fixbug', 1]
    ])
    const feature = tree.folders[0]
    expect(feature.leaves.map((l) => [l.name, l.item])).toEqual([
      ['auth', 'feature/auth'],
      ['search', 'feature/search']
    ])
    expect(feature.folders.map((f) => [f.path, f.count, f.leaves.map((l) => l.item)])).toEqual([['feature/ui', 1, ['feature/ui/dark-mode']]])
    expect(someLeaf(feature, (n) => n === 'feature/ui/dark-mode')).toBe(true)
    expect(someLeaf(feature, (n) => n === 'main')).toBe(false)
  })

  it('keeps a flat list flat', () => {
    const tree = buildBranchTree(['b', 'a'], (n) => n)
    expect(tree.folders).toEqual([])
    expect(tree.leaves.map((l) => l.name)).toEqual(['a', 'b'])
  })
})
