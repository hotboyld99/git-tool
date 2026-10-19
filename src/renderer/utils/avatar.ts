/** "Trung Hieu" -> "TH", "alice" -> "A" */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words
  return letters.map((w) => [...w][0]).join('').toUpperCase() || '?'
}

/** GitHub noreply addresses ("123+user@" or "user@users.noreply.github.com") map straight to the GitHub avatar. */
export function githubAvatar(email: string): string | null {
  const m = /^(?:(\d+)\+)?([^@+]+)@users\.noreply\.github\.com$/i.exec(email.trim())
  if (!m) return null
  return m[1] ? `https://avatars.githubusercontent.com/u/${m[1]}?s=64` : `https://github.com/${encodeURIComponent(m[2])}.png?size=64`
}

const urls = new Map<string, Promise<string>>()
/** image urls that failed to load (no avatar / offline): not retried while the app runs */
export const failedAvatars = new Set<string>()

/** Avatar url of an author: GitHub for noreply emails, else Gravatar (404 when the email has none, so the caller falls back). */
export function avatarUrl(email: string): Promise<string> {
  const key = email.trim().toLowerCase()
  let url = urls.get(key)
  if (!url) {
    const github = githubAvatar(key)
    url = github
      ? Promise.resolve(github)
      : crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)).then((buf) => {
          const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
          return `https://gravatar.com/avatar/${hex}?s=64&d=404`
        })
    urls.set(key, url)
  }
  return url
}
