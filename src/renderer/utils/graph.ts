import type { GitCommit } from '../../shared/types'
import { PALETTE, branchColor } from './colors'

/**
 * Segment of a row. Rows are drawn in two halves around the commit node:
 * - full:   vertical line through the whole row (lane not touching this commit)
 * - top:    from `fromLane` at the top edge to `toLane` at the node (child lines arriving)
 * - bottom: from `fromLane` at the node to `toLane` at the bottom edge (lines to parents)
 */
export interface GraphEdge {
  fromLane: number
  toLane: number
  type: 'straight' | 'branch' | 'merge'
  part: 'full' | 'top' | 'bottom'
  color: string
}

export interface GraphNode {
  commitHash: string
  lane: number
  color: string
  isMerge: boolean
  edges: GraphEdge[]
}

export interface Graph {
  nodes: GraphNode[]
  /** number of lanes needed to draw every row */
  width: number
}

function freeSlot(lanes: (string | null)[]): number {
  const i = lanes.indexOf(null)
  return i === -1 ? lanes.length : i
}

/** Name used to color a lane started by this commit (local branch preferred over remote/tag). */
function refName(refs: string[], remotes: string[]): string | null {
  const names = refs.filter((r) => r !== 'HEAD' && !r.startsWith('tag: '))
  const local = names.find((r) => !remotes.some((rm) => r.startsWith(`${rm}/`)))
  if (local) return local
  const remote = names[0]
  return remote ? remote.slice(remote.indexOf('/') + 1) : null
}

/**
 * Assigns lanes to commits listed newest first (git log --date-order: children before parents).
 * Each lane holds the hash of the commit it is waiting for; a commit takes the lane expecting it
 * (or a free one when it is a branch tip), lines of other children converge into it, its first
 * parent continues in the same lane and further parents (merges) get existing or new lanes.
 */
export function computeGraph(commits: GitCommit[], remotes: string[] = []): Graph {
  const lanes: (string | null)[] = []
  const colors: string[] = []
  const nodes: GraphNode[] = []
  let width = 0
  let colorSeq = 0
  const nextColor = (): string => PALETTE[colorSeq++ % PALETTE.length]

  for (const commit of commits) {
    const before = lanes.slice()
    let lane = lanes.indexOf(commit.hash)
    if (lane === -1) {
      lane = freeSlot(lanes)
      const name = refName(commit.refs, remotes)
      colors[lane] = name ? branchColor(name) : nextColor()
    }
    const color = colors[lane]
    const edges: GraphEdge[] = []

    before.forEach((hash, j) => {
      if (hash === null) return
      if (hash !== commit.hash) edges.push({ fromLane: j, toLane: j, type: 'straight', part: 'full', color: colors[j] })
      else if (j === lane) edges.push({ fromLane: j, toLane: j, type: 'straight', part: 'top', color })
      else {
        edges.push({ fromLane: j, toLane: lane, type: 'branch', part: 'top', color: colors[j] })
        lanes[j] = null
      }
    })

    const [first, ...others] = commit.parents
    lanes[lane] = first ?? null
    if (first) edges.push({ fromLane: lane, toLane: lane, type: 'straight', part: 'bottom', color })
    for (const parent of others) {
      let target = lanes.indexOf(parent)
      if (target === -1) {
        target = freeSlot(lanes)
        lanes[target] = parent
        colors[target] = nextColor()
      }
      edges.push({ fromLane: lane, toLane: target, type: 'merge', part: 'bottom', color: colors[target] })
    }

    width = Math.max(width, lanes.length, before.length, lane + 1)
    while (lanes.length && lanes[lanes.length - 1] === null) lanes.pop()
    nodes.push({ commitHash: commit.hash, lane, color, isMerge: commit.parents.length > 1, edges })
  }
  return { nodes, width }
}
