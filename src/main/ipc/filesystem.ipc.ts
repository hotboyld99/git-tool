import type { RepositoryService } from '../services/repository.service'
import { openFile, revealFile } from '../services/filesystem.service'
import { handle, str } from './handle'

export function registerFilesystemIpc(repos: RepositoryService): void {
  handle('system:openFile', (id, file) => openFile(repos.get(id).path, str(file)))
  handle('system:reveal', (id, file) => revealFile(repos.get(id).path, str(file)))
}
