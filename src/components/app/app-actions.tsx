"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

import type { MovementType } from "@/lib/domain"
import type { Transaction } from "@/lib/schema"

/**
 * App-wide actions any screen, the command palette or a keyboard shortcut can trigger: log a
 * movement (iOS "+" sheet), edit one, open its detail, or add an account or card. The dialogs that
 * fulfill them are mounted once in the shell.
 */
export type EditorRequest = { mode: "create"; type?: MovementType; accountId?: string; isDraft?: boolean } | { mode: "edit"; transaction: Transaction }

export type AddAccountRequest = { kind?: "debit" | "credit" | "wallet" }

interface AppActions {
  editor: EditorRequest | undefined
  openEditor: (request?: EditorRequest) => void
  closeEditor: () => void
  /** The movement whose detail panel is open. */
  detailId: string | undefined
  showDetail: (id: string | undefined) => void
  addAccount: AddAccountRequest | undefined
  openAddAccount: (request?: AddAccountRequest) => void
  closeAddAccount: () => void
  shortcutsOpen: boolean
  setShortcutsOpen: (open: boolean) => void
  paletteOpen: boolean
  setPaletteOpen: (open: boolean) => void
}

const AppActionsContext = createContext<AppActions | undefined>(undefined)

export function AppActionsProvider({ children }: { children: ReactNode }) {
  const [editor, setEditor] = useState<EditorRequest>()
  const [detailId, setDetailId] = useState<string>()
  const [addAccount, setAddAccount] = useState<AddAccountRequest>()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  const openEditor = useCallback((request: EditorRequest = { mode: "create" }) => {
    setPaletteOpen(false)
    setEditor(request)
  }, [])
  const closeEditor = useCallback(() => setEditor(undefined), [])
  const openAddAccount = useCallback((request: AddAccountRequest = {}) => {
    setPaletteOpen(false)
    setAddAccount(request)
  }, [])
  const closeAddAccount = useCallback(() => setAddAccount(undefined), [])

  const value = useMemo(
    () => ({ editor, openEditor, closeEditor, detailId, showDetail: setDetailId, addAccount, openAddAccount, closeAddAccount, shortcutsOpen, setShortcutsOpen, paletteOpen, setPaletteOpen }),
    [editor, openEditor, closeEditor, detailId, addAccount, openAddAccount, closeAddAccount, shortcutsOpen, paletteOpen],
  )
  return <AppActionsContext.Provider value={value}>{children}</AppActionsContext.Provider>
}

export function useAppActions(): AppActions {
  const value = useContext(AppActionsContext)
  if (!value) throw new Error("useAppActions needs AppActionsProvider")
  return value
}
