import { useEffect, useMemo, useState } from 'react'
import { Search, User, X } from 'lucide-react'
import type { RepositoryId } from '../../../shared/types'
import { setHistoryFilter, useRepo } from '../../stores/repository.store'

const input = 'h-6 rounded border border-line bg-bg px-2 outline-none placeholder:text-faint focus:border-accent'

/** Search (message / hash), author and branch filters; text filters are debounced. */
export function HistoryFilterBar({ id }: { id: RepositoryId }) {
  const { historyFilter, branches, commits } = useRepo(id)
  const [search, setSearch] = useState(historyFilter.search)
  const [author, setAuthor] = useState(historyFilter.author)
  const authors = useMemo(() => [...new Set(commits.map((c) => c.authorName))].slice(0, 100), [commits])

  useEffect(() => {
    if (search === historyFilter.search && author === historyFilter.author) return
    const timer = setTimeout(() => setHistoryFilter(id, { search, author }), 300)
    return () => clearTimeout(timer)
  }, [id, search, author, historyFilter])

  const active = !!(historyFilter.search || historyFilter.author || historyFilter.ref)

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line bg-panel px-2">
      <label className="flex min-w-0 flex-1 items-center gap-1.5">
        <Search size={13} className="shrink-0 text-muted" />
        <input className={`${input} w-full`} placeholder="Search commit message or hash" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      <label className="flex items-center gap-1.5">
        <User size={13} className="shrink-0 text-muted" />
        <input className={`${input} w-36`} placeholder="Author" list={`authors-${id}`} value={author} onChange={(e) => setAuthor(e.target.value)} />
        <datalist id={`authors-${id}`}>
          {authors.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </label>
      <select className={`${input} max-w-48`} value={historyFilter.ref} onChange={(e) => setHistoryFilter(id, { ref: e.target.value })}>
        <option value="">All branches</option>
        {branches.map((b) => (
          <option key={b.name} value={b.name}>
            {b.name}
          </option>
        ))}
      </select>
      {active && (
        <button
          title="Clear filters"
          className="rounded p-1 text-muted hover:bg-hover hover:text-fg"
          onClick={() => {
            setSearch('')
            setAuthor('')
            setHistoryFilter(id, { search: '', author: '', ref: '' })
          }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}
