import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import type { RepositoryId, RepositoryInfo } from '../../shared/types'

/**
 * Registry of opened repositories. The renderer only ever sends a RepositoryId;
 * the validated path is looked up here, so IPC calls cannot target arbitrary folders.
 */
export class RepositoryService {
  private repos = new Map<RepositoryId, RepositoryInfo>()

  register(folder: string): RepositoryInfo {
    const path = resolve(folder)
    // `.git` is a directory for normal repositories and a file for worktrees/submodules
    if (!existsSync(join(path, '.git'))) throw new Error('This folder is not a Git repository.')
    const id = createHash('sha1').update(path).digest('hex').slice(0, 12)
    const repo = { id, path, name: basename(path) }
    this.repos.set(id, repo)
    return repo
  }

  unregister(id: RepositoryId): void {
    this.repos.delete(id)
  }

  get(id: unknown): RepositoryInfo {
    const repo = typeof id === 'string' ? this.repos.get(id) : undefined
    if (!repo) throw new Error('Repository is not open.')
    return repo
  }

  has(id: RepositoryId): boolean {
    return this.repos.has(id)
  }

  list(): RepositoryInfo[] {
    return [...this.repos.values()]
  }
}
