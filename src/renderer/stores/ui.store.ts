import type { MouseEvent } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GitError, RepositoryId } from '../../shared/types'

export interface MenuItem {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}
export type MenuEntry = MenuItem | 'separator'

export type Dialog =
  | { type: 'confirm'; title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void }
  | { type: 'createBranch'; repoId: RepositoryId; startPoint: string | null; startLabel: string }
  | { type: 'stash'; repoId: RepositoryId }
  | { type: 'createTag'; repoId: RepositoryId; hash: string; label: string }
  | { type: 'reset'; repoId: RepositoryId; hash: string; label: string; branch: string }
  | { type: 'remote'; repoId: RepositoryId; name?: string; url?: string }
  | { type: 'settings' }
  | { type: 'interactiveRebase'; repoId: RepositoryId; base: string; label: string }
  | { type: 'flowStart'; repoId: RepositoryId; kind: 'feature' | 'release' | 'hotfix' }
  | { type: 'worktree'; repoId: RepositoryId }

interface UiState {
  sidebarWidth: number
  detailWidth: number
  diffMode: 'unified' | 'split' | 'blame'
  ignoreWhitespace: boolean
  logOpen: boolean
  dialog: Dialog | null
  menu: { x: number; y: number; items: MenuEntry[] } | null
  error: GitError | null
}

export const useUi = create<UiState>()(
  persist(
    (): UiState => ({
      sidebarWidth: 260,
      detailWidth: 400,
      diffMode: 'unified',
      ignoreWhitespace: false,
      logOpen: false,
      dialog: null,
      menu: null,
      error: null
    }),
    {
      name: 'ui',
      partialize: ({ sidebarWidth, detailWidth, diffMode, ignoreWhitespace, logOpen }) => ({
        sidebarWidth,
        detailWidth,
        diffMode,
        ignoreWhitespace,
        logOpen
      })
    }
  )
)

export function setUi(partial: Partial<UiState>): void {
  useUi.setState(partial)
}

export const showError = (error: GitError): void => setUi({ error })

export const openDialog = (dialog: Dialog): void => setUi({ dialog })

export const closeDialog = (): void => setUi({ dialog: null })

export function confirm(options: Omit<Extract<Dialog, { type: 'confirm' }>, 'type'>): void {
  openDialog({ type: 'confirm', ...options })
}

export function openMenu(e: MouseEvent, items: MenuEntry[]): void {
  e.preventDefault()
  e.stopPropagation()
  setUi({ menu: { x: e.clientX, y: e.clientY, items } })
}
