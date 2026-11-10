import { describe, expect, it } from 'vitest'
import { pick } from '../src/renderer/utils/pick'

describe('pick', () => {
  const order = ['a', 'b', 'c', 'd']
  const none = { toggle: false, range: false }

  it('picks one on a plain click', () => expect(pick(order, ['a', 'b'], 'a', 'c', none)).toEqual(['c']))

  it('toggles with Cmd/Ctrl', () => {
    expect(pick(order, ['a'], 'a', 'c', { toggle: true, range: false })).toEqual(['a', 'c'])
    expect(pick(order, ['a', 'c'], 'c', 'a', { toggle: true, range: false })).toEqual(['c'])
  })

  it('picks a range with Shift, in both directions', () => {
    expect(pick(order, ['b'], 'b', 'd', { toggle: false, range: true })).toEqual(['b', 'c', 'd'])
    expect(pick(order, ['c'], 'c', 'a', { toggle: false, range: true })).toEqual(['a', 'b', 'c'])
    // anchor gone (file was staged meanwhile): behaves like a plain click
    expect(pick(order, [], 'x', 'b', { toggle: false, range: true })).toEqual(['b'])
  })
})
