import { describe, expect, it } from 'vitest'
import { githubAvatar, initials } from '../src/renderer/utils/avatar'

describe('avatar', () => {
  it('builds initials from first and last word', () => {
    expect(initials('Trung Hieu')).toBe('TH')
    expect(initials('  alice ')).toBe('A')
    expect(initials('Nguyễn Văn Ánh')).toBe('NÁ')
    expect(initials('')).toBe('?')
  })

  it('maps GitHub noreply emails to GitHub avatars', () => {
    expect(githubAvatar('123+bob@users.noreply.github.com')).toBe('https://avatars.githubusercontent.com/u/123?s=64')
    expect(githubAvatar('bob@users.noreply.github.com')).toBe('https://github.com/bob.png?size=64')
    expect(githubAvatar('bob@example.com')).toBeNull()
  })
})
