export interface BranchLeaf<T> {
  /** last path segment, e.g. "search" for "feature/search" */
  name: string
  item: T
}

export interface BranchNode<T> {
  folders: BranchFolder<T>[]
  leaves: BranchLeaf<T>[]
}

export interface BranchFolder<T> extends BranchNode<T> {
  name: string
  /** full prefix, e.g. "feature/ui" */
  path: string
  /** number of branches below this folder (all levels) */
  count: number
}

const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name)

function sortNode<T>(node: BranchNode<T>): void {
  node.folders.sort(byName)
  node.leaves.sort(byName)
  node.folders.forEach(sortNode)
}

/** Groups branch names into folders by their "/" separated prefixes: feature/a, feature/b -> feature/{a, b}. */
export function buildBranchTree<T>(items: T[], nameOf: (item: T) => string): BranchNode<T> {
  const root: BranchNode<T> = { folders: [], leaves: [] }
  for (const item of items) {
    const parts = nameOf(item).split('/')
    let node = root
    let path = ''
    for (const part of parts.slice(0, -1)) {
      path = path ? `${path}/${part}` : part
      let folder = node.folders.find((f) => f.name === part)
      if (!folder) {
        folder = { name: part, path, count: 0, folders: [], leaves: [] }
        node.folders.push(folder)
      }
      folder.count++
      node = folder
    }
    node.leaves.push({ name: parts[parts.length - 1], item })
  }
  sortNode(root)
  return root
}

export function someLeaf<T>(node: BranchNode<T>, predicate: (item: T) => boolean): boolean {
  return node.leaves.some((l) => predicate(l.item)) || node.folders.some((f) => someLeaf(f, predicate))
}
