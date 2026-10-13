import { useEffect, useRef } from 'react'
import type { GraphNode } from '../../utils/graph'

export const LANE_WIDTH = 14
const PADDING = 6
const laneX = (lane: number): number => PADDING + lane * LANE_WIDTH + LANE_WIDTH / 2

/** Draws one row of the commit graph: its edge segments and the commit node. */
export function GraphCanvas({ node, width, height }: { node: GraphNode; width: number; height: number }) {
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
      ctx.beginPath()
      if (edge.part === 'full') {
        ctx.moveTo(x1, 0)
        ctx.lineTo(x1, height)
      } else if (edge.part === 'top') {
        // child line coming down from lane x1, bending into the node
        ctx.moveTo(x1, 0)
        if (x1 === x2) ctx.lineTo(x2, mid)
        else ctx.quadraticCurveTo(x1, mid, x2, mid)
      } else {
        // line leaving the node towards a parent lane, bending down
        ctx.moveTo(x1, mid)
        if (x1 === x2) ctx.lineTo(x2, height)
        else ctx.quadraticCurveTo(x2, mid, x2, height)
      }
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.arc(laneX(node.lane), mid, node.isMerge ? 3.5 : 5, 0, Math.PI * 2)
    ctx.fillStyle = node.color
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#16191d'
    ctx.stroke()
  }, [node, width, height])

  return <canvas ref={ref} className="shrink-0" style={{ width, height }} />
}

export const graphWidth = (lanes: number): number => PADDING * 2 + Math.max(lanes, 4) * LANE_WIDTH
