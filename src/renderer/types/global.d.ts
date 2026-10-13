import type { GitApi, RepoApi, SystemApi } from '../../shared/types'

declare global {
  interface Window {
    git: GitApi
    repo: RepoApi
    system: SystemApi
  }
}
