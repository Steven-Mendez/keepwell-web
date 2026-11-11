"use client"

import { BookOpenIcon, BotIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { KWButton } from "@/components/kw/design"
import { toast } from "@/components/ui/toast"
import { connectedClients, disconnectAll, revokeClient, type ConnectedClient } from "@/lib/api/connect"
import type { Translator } from "@/lib/i18n"

import { ConfirmDialog } from "./confirm-dialog"
import { SettingsLinkRow, SettingsRow, SettingsSection } from "./settings-rows"

/** Assistants connected through MCP (Claude and others), each revocable, and a switch for all at once. */
export function ConnectedAppsSection({ t }: { t: Translator }) {
  const [clients, setClients] = useState<ConnectedClient[]>()
  const [confirmingAll, setConfirmingAll] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    connectedClients().then(
      (list) => !cancelled && setClients(list),
      () => !cancelled && setClients([])
    )
    return () => {
      cancelled = true
    }
  }, [version])

  const run = async (work: () => Promise<void>) => {
    try {
      await work()
      setVersion((v) => v + 1)
    } catch {
      toast.add({ title: t.in("web", "Couldn't reach Keepwell. Try again."), type: "error" })
    }
  }

  return (
    <SettingsSection
      id="assistants"
      title={t.in("web", "Connected assistants")}
      footnote={t.in("web", "Assistants like Claude can read your data and record movements you then confirm here.")}
    >
      {clients === undefined ? null : clients.length === 0 ? (
        <SettingsRow icon={<BotIcon strokeWidth={2} />} label={t.in("web", "None connected")} />
      ) : (
        clients.map((client) => (
          <SettingsRow
            key={client.client_id}
            icon={<BotIcon strokeWidth={2} />}
            label={client.name ?? client.client_id}
            description={client.scopes.includes("write") ? t.in("web", "Can read and record") : t.in("web", "Can read")}
          >
            <KWButton variant="secondary" size="small" onClick={() => void run(() => revokeClient(client.client_id))}>
              {t.in("web", "Disconnect")}
            </KWButton>
          </SettingsRow>
        ))
      )}
      <SettingsLinkRow icon={<BookOpenIcon strokeWidth={2} />} label={t.in("web", "How to connect Claude")} description={t.in("web", "Step by step, on the web, desktop, phone and Claude Code.")} href="/docs/mcp" />
      <SettingsLinkRow icon="close" tone="destructive" label={t.in("web", "Disconnect everything")} description={t.in("web", "Every assistant loses access at once.")} onClick={() => setConfirmingAll(true)} />
      <ConfirmDialog
        open={confirmingAll}
        onOpenChange={setConfirmingAll}
        title={t.in("web", "Disconnect every assistant?")}
        description={t.in("web", "They lose access right away and would have to be connected again.")}
        action={t.in("web", "Disconnect all")}
        destructive
        onConfirm={() => void run(disconnectAll)}
      />
    </SettingsSection>
  )
}
