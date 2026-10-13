import Store from 'electron-store'

interface Schema {
  recentRepositories: string[]
  openedRepositories: string[]
  activeRepository: string | null
}

const MAX_RECENT = 10

const store = new Store<Schema>({
  defaults: { recentRepositories: [], openedRepositories: [], activeRepository: null }
})

export const settings = {
  get: <K extends keyof Schema>(key: K): Schema[K] => store.get(key),
  setOpened: (paths: string[]): void => store.set('openedRepositories', paths),
  setActive: (path: string | null): void => store.set('activeRepository', path),
  addRecent: (path: string): void => {
    const recent = [path, ...store.get('recentRepositories').filter((p) => p !== path)].slice(0, MAX_RECENT)
    store.set('recentRepositories', recent)
  }
}
