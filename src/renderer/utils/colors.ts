export const PALETTE = ['#4c9aff', '#2fd3c8', '#a77bf3', '#f472b6', '#fb923c', '#4ade80', '#facc15', '#f87171', '#38bdf8', '#c084fc']

/** Stable color for a branch name: well-known names get fixed colors, others a hash-based one. */
export function branchColor(name: string): string {
  if (/^(main|master|trunk)$/.test(name)) return '#4c9aff'
  if (/^(dev|develop|development)$/.test(name)) return '#2fd3c8'
  if (/^staging$/.test(name)) return '#4ade80'
  if (/^feat(ure)?[/-]/.test(name)) return '#a77bf3'
  if (/^(fix|bugfix|hotfix|fixbug)/.test(name)) return '#f472b6'
  if (/^release/.test(name)) return '#fb923c'
  return hashColor(name)
}

/** Stable palette color for any string (e.g. an author email). */
export function hashColor(text: string): string {
  let hash = 0
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}
