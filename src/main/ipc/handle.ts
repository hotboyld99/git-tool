import { ipcMain } from 'electron'
import type { Result } from '../../shared/types'
import { toGitError } from '../git/executor'

/** Registers an IPC handler whose result (or error) is wrapped into a serializable Result. */
export function handle(channel: string, fn: (...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]): Promise<Result<unknown>> => {
    try {
      return { ok: true, data: await fn(...args) }
    } catch (e) {
      return { ok: false, error: toGitError(e, channel.split(':')[1]) }
    }
  })
}

// Arguments coming from the renderer are untrusted: validate their shape at the boundary.
export function str(v: unknown): string {
  if (typeof v !== 'string') throw new Error('Invalid argument: expected a string.')
  return v
}

export function strs(v: unknown): string[] {
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) throw new Error('Invalid argument: expected a list of strings.')
  return v
}

export function bool(v: unknown): boolean {
  return v === true
}

export function int(v: unknown, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new Error('Invalid argument: expected an integer.')
  return v
}

export function obj(v: unknown): Record<string, unknown> {
  if (typeof v !== 'object' || v === null) throw new Error('Invalid argument: expected an object.')
  return v as Record<string, unknown>
}
