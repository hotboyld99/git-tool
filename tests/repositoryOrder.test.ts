import { describe, expect, it } from 'vitest'
import { RepositoryService } from '../src/main/services/repository.service'
import { tempRepo } from './helpers'

describe('RepositoryService.reorder', () => {
  it('reorders tabs, ignoring unknown ids and keeping unlisted ones at the end', () => {
    const repos = new RepositoryService()
    const [a, b, c] = [tempRepo(), tempRepo(), tempRepo()].map((r) => repos.register(r.dir).id)
    repos.reorder([c, 'nope', a])
    expect(repos.list().map((r) => r.id)).toEqual([c, a, b])
  })
})
