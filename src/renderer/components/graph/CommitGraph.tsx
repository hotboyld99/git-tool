import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { RepositoryId } from '../../../shared/types'
import { loadMoreHistory, select, useRepo } from '../../stores/repository.store'
import { computeGraph, flatGraph } from '../../utils/graph'
import { Spinner } from '../common/Spinner'
import { graphWidth } from './GraphCanvas'
import { CommitRow, ROW_HEIGHT } from './CommitRow'
import { HistoryFilterBar } from './HistoryFilterBar'

// ponytail: lanes beyond this are clipped; add horizontal graph scrolling if real repos need more
const MAX_VISIBLE_LANES = 24

export function CommitGraph({ id }: { id: RepositoryId }) {
  const { commits, remotes, status, selection, loading, hasMoreCommits, historyFilter } = useRepo(id)
  const remoteNames = useMemo(() => remotes.map((r) => r.name), [remotes])
  const textFiltered = !!(historyFilter.search.trim() || historyFilter.author.trim())
  const graph = useMemo(() => (textFiltered ? flatGraph(commits) : computeGraph(commits, remoteNames)), [commits, remoteNames, textFiltered])
  const width = graphWidth(Math.min(graph.width, MAX_VISIBLE_LANES))
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: commits.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20
  })
  const items = virtualizer.getVirtualItems()
  const lastIndex = items[items.length - 1]?.index ?? 0

  // lazy loading: fetch the next page when the user scrolls near the end
  useEffect(() => {
    if (hasMoreCommits && lastIndex >= commits.length - 30) void loadMoreHistory(id)
  }, [id, lastIndex, commits.length, hasMoreCommits])

  const selectedHash = selection.type === 'commit' ? selection.hash : null
  const currentBranch = status?.branch ?? null
  const selectedIndex = selectedHash ? commits.findIndex((c) => c.hash === selectedHash) : -1

  // bring the selected commit into view (e.g. selected from the sidebar); no-op when already visible
  useEffect(() => {
    if (selectedIndex >= 0) virtualizer.scrollToIndex(selectedIndex, { align: 'auto' })
  }, [selectedIndex, virtualizer])

  const onKeyDown = (e: KeyboardEvent): void => {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    const next = commits[Math.max(0, selectedIndex + step)]
    if (!step || !next) return
    e.preventDefault()
    select(id, { type: 'commit', hash: next.hash })
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <HistoryFilterBar id={id} />
      <div className="flex h-7 shrink-0 items-center border-b border-line text-[10px] font-semibold tracking-wider text-faint uppercase">
        <div className="w-44 shrink-0 px-2">Branch / Tag</div>
        <div className="shrink-0 px-1.5" style={{ width }}>
          Graph
        </div>
        <div className="flex-1 pl-2">Commit message</div>
        <div className="w-36 shrink-0 px-2">Author</div>
        <div className="flex w-32 shrink-0 items-center gap-1 px-2">Date {loading.log && <Spinner size={10} />}</div>
      </div>
      <div ref={scrollRef} tabIndex={0} onKeyDown={onKeyDown} className="min-h-0 flex-1 overflow-y-auto outline-none">
        {commits.length === 0 && !loading.log && (
          <div className="p-6 text-center text-muted">
            {textFiltered || historyFilter.ref ? 'No commits match the filters.' : 'No commits yet.'}
          </div>
        )}
        <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {items.map((item) => {
            const commit = commits[item.index]
            return (
              <CommitRow
                key={commit.hash}
                repoId={id}
                commit={commit}
                node={graph.nodes[item.index]}
                graphWidth={width}
                top={item.start}
                selected={commit.hash === selectedHash}
                remotes={remoteNames}
                currentBranch={currentBranch}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
