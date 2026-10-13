const pad = (n: number): string => String(n).padStart(2, '0')

/** ISO date -> "2026-10-13 14:20" in local time */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

export function splitPath(path: string): { dir: string; name: string } {
  const i = path.lastIndexOf('/')
  return i === -1 ? { dir: '', name: path } : { dir: path.slice(0, i + 1), name: path.slice(i + 1) }
}

/** Short, human readable summary of a Git error output: prefers the first error/fatal line. */
export function errorSummary(stderr: string): string {
  const lines = stderr.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('hint:'))
  const main = lines.find((l) => /^(error|fatal):/.test(l)) ?? lines.find((l) => l.startsWith('!')) ?? lines[0] ?? ''
  return main.replace(/^(error|fatal):\s*/, '')
}
