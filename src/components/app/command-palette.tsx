"use client"

import { ArrowDownLeftIcon, ArrowLeftRightIcon, ArrowUpRightIcon, CreditCardIcon, KeyboardIcon, RepeatIcon, TagsIcon, WandSparklesIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command"
import { useLedger, useTransactionDisplay } from "@/hooks/use-ledger"
import { useT } from "@/lib/i18n"
import { accountName } from "@/lib/presentation/display"

import { useAppActions } from "./app-actions"
import { MAIN_NAV, NOTIFICATIONS_NAV, SECTION_NAV, SETTINGS_NAV } from "./navigation"

/** ⌘K: jump to any section, account or recent movement, or start an action, without the mouse. */
export function CommandPalette() {
  const t = useT()
  const router = useRouter()
  const ledger = useLedger()
  const display = useTransactionDisplay(ledger)
  const { paletteOpen, setPaletteOpen, openEditor, openAddAccount, openRuleEditor, showDetail, setShortcutsOpen } = useAppActions()

  const run = (work: () => void) => {
    setPaletteOpen(false)
    work()
  }

  return (
    <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen} title={t.in("sharedpresentation", "Command palette")} description={t.in("web", "Search or jump to…")}>
      <CommandInput placeholder={t.in("web", "Search or jump to…")} />
      <CommandList>
        <CommandEmpty>{t.in("web", "No results.")}</CommandEmpty>
        <CommandGroup heading={t.in("sharedpresentation", "Actions")}>
          <CommandItem onSelect={() => run(() => openEditor({ mode: "create", type: "expense" }))}>
            <ArrowUpRightIcon />
            {t.in("sharedpresentation", "New expense")}
            <CommandShortcut>E</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => openEditor({ mode: "create", type: "income" }))}>
            <ArrowDownLeftIcon />
            {t.in("sharedpresentation", "New income")}
            <CommandShortcut>I</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => openEditor({ mode: "create", type: "transfer" }))}>
            <ArrowLeftRightIcon />
            {t.in("sharedpresentation", "New transfer")}
            <CommandShortcut>T</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => openAddAccount())}>
            <CreditCardIcon />
            {t.in("accounts", "Add account or card")}
          </CommandItem>
          <CommandItem onSelect={() => run(() => openRuleEditor({ mode: "create" }))}>
            <RepeatIcon />
            {t.in("recurring", "Add recurring")}
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push("/settings/categories"))}>
            <TagsIcon />
            {t.in("settings", "Categories")}
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push("/settings/rules"))}>
            <WandSparklesIcon />
            {t.in("settings", "Rules")}
          </CommandItem>
          <CommandItem onSelect={() => run(() => setShortcutsOpen(true))}>
            <KeyboardIcon />
            {t.in("sharedpresentation", "Keyboard shortcuts")}
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading={t.in("sharedpresentation", "Go to")}>
          {[...MAIN_NAV, ...SECTION_NAV, SETTINGS_NAV, NOTIFICATIONS_NAV].map((item, index) => (
            <CommandItem key={item.href} onSelect={() => run(() => router.push(item.href))}>
              <item.icon />
              {t.in(item.ns, item.title)}
              <CommandShortcut>{index < MAIN_NAV.length ? index + 1 : SECTION_NAV.includes(item) || item === NOTIFICATIONS_NAV ? `G ${item.key.toUpperCase()}` : item.key}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
        {ledger && ledger.accounts.length > 0 ? (
          <CommandGroup heading={t.in("accounts", "Accounts")}>
            {ledger.accounts.map((account) => (
              <CommandItem key={account.id} value={`account ${accountName(account)}`} onSelect={() => run(() => router.push(`/accounts?id=${account.id}`))}>
                <CreditCardIcon />
                {accountName(account)}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {ledger && display && ledger.transactions.length > 0 ? (
          <CommandGroup heading={t.in("transactions", "Transactions")}>
            {ledger.transactions.slice(0, 50).map((transaction) => (
              <CommandItem key={transaction.id} value={`movement ${display.searchableText(transaction)} ${transaction.id}`} onSelect={() => run(() => showDetail(transaction.id))}>
                <span className="flex-1 truncate">{transaction.description}</span>
                <span className="type-caption text-muted-foreground tabular-nums">{display.amount(transaction)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  )
}
