import { useEffect, useRef } from 'react'
import type { GraphNode, GraphRow } from '../../utils/graph'

export const LANE_WIDTH = 22
const PADDING = 10
/** corner radius where a line turns between lanes: small = squarer bends */
const CORNER = 12
export const laneX = (lane: number): number => PADDING + lane * LANE_WIDTH + LANE_WIDTH / 2

/** Draws one row of the commit graph: its edge segments and the commit node. */
/** `highlight` (hovered row) enlarges the node; `kind` draws WIP as a dashed ring and stashes as a hollow square. */
export function GraphCanvas({ node, width, height, highlight, kind = 'commit' }: { node: GraphNode; width: number; height: number; highlight?: boolean; kind?: GraphRow['kind'] }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    const mid = height / 2

    for (const edge of node.edges) {
      const x1 = laneX(edge.fromLane)
      const x2 = laneX(edge.toLane)
      ctx.strokeStyle = edge.color
      ctx.lineWidth = 2
      ctx.beginPath()
      if (edge.part === 'full') {
        ctx.moveTo(x1, 0)
        ctx.lineTo(x1, height)
      } else if (edge.part === 'top') {
        // child line coming down from lane x1, bending into the node
        ctx.moveTo(x1, 0)
        if (x1 !== x2) ctx.arcTo(x1, mid, x2, mid, CORNER)
        ctx.lineTo(x2, mid)
      } else {
        // line leaving the node towards a parent lane, bending down
        ctx.moveTo(x1, mid)
        if (x1 !== x2) ctx.arcTo(x2, mid, x2, height, CORNER)
        ctx.lineTo(x2, height)
      }
      ctx.stroke()
    }

    // regular commits show the author avatar on top of the canvas instead (see CommitRow); merges keep a small dot
    if (kind === 'commit' && !node.isMerge) return
    const r = (node.isMerge ? 4 : 5) + (highlight ? 1.5 : 2)
    ctx.beginPath()
    if (kind === 'stash') ctx.rect(laneX(node.lane) - r, mid - r, r * 2, r * 2)
    else ctx.arc(laneX(node.lane), mid, r, 0, Math.PI * 2)
    ctx.lineWidth = 2
    ctx.fillStyle = kind === 'commit' ? node.color : '#16191d'
    ctx.fill()
    if (kind === 'wip') ctx.setLineDash([2, 2])
    ctx.strokeStyle = kind === 'commit' ? (highlight ? '#ffffff' : '#16191d') : node.color
    ctx.stroke()
    ctx.setLineDash([])
  }, [node, width, height, highlight, kind])

  return <canvas ref={ref} className="shrink-0" style={{ width, height }} />
}

export const graphWidth = (lanes: number): number => PADDING * 2 + Math.max(lanes, 4) * LANE_WIDTH
