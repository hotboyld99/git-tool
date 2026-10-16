import Store from 'electron-store'

interface Schema {
  recentRepositories: string[]
  openedRepositories: string[]
  activeRepository: string | null
  gitPath: string | null
  window: { x?: number; y?: number; width: number; height: number; maximized: boolean }
}

const MAX_RECENT = 10

const store = new Store<Schema>({
  defaults: { recentRepositories: [], openedRepositories: [], activeRepository: null, gitPath: null, window: { width: 1440, height: 900, maximized: false } }
})

export const settings = {
  get: <K extends keyof Schema>(key: K): Schema[K] => store.get(key),
  setOpened: (paths: string[]): void => store.set('openedRepositories', paths),
  setActive: (path: string | null): void => store.set('activeRepository', path),
  setGitPath: (path: string | null): void => store.set('gitPath', path),
  setWindow: (bounds: Schema['window']): void => store.set('window', bounds),
  addRecent: (path: string): void => {
    const recent = [path, ...store.get('recentRepositories').filter((p) => p !== path)].slice(0, MAX_RECENT)
    store.set('recentRepositories', recent)
  }
}
