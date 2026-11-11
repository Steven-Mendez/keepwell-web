"use client"

import { CircleAlertIcon, InfoIcon, LightbulbIcon } from "lucide-react"
import type { ReactNode } from "react"

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
} from "@/components/ui/code-block"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

/** A highlighted note: `note` for context, `tip` for a shortcut, `warning` for what can go wrong. */
export function Callout({
  kind = "note",
  title,
  children,
}: {
  kind?: "note" | "tip" | "warning"
  title?: string
  children: ReactNode
}) {
  const Icon =
    kind === "warning"
      ? CircleAlertIcon
      : kind === "tip"
        ? LightbulbIcon
        : InfoIcon
  const tone =
    kind === "warning"
      ? "border-amber-500/30 bg-amber-500/8 [&_svg]:text-amber-600 dark:[&_svg]:text-amber-400"
      : kind === "tip"
        ? "border-emerald-500/30 bg-emerald-500/8 [&_svg]:text-emerald-600 dark:[&_svg]:text-emerald-400"
        : "border-brand-600/25 bg-brand-600/6 [&_svg]:text-brand-600 dark:[&_svg]:text-brand-500"
  return (
    <div
      role="note"
      className={`flex gap-3 rounded-xl border px-4 py-3 ${tone}`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
      <div className="flex min-w-0 flex-col gap-1 type-body">
        {title ? (
          <p className="font-semibold text-foreground">{title}</p>
        ) : null}
        <div className="text-text-secondary [&_strong]:text-foreground">
          {children}
        </div>
      </div>
    </div>
  )
}

/** Numbered steps on a rail, each with a short title and its detail. */
export function Steps({
  items,
}: {
  items: { title: ReactNode; body?: ReactNode }[]
}) {
  return (
    <ol className="flex flex-col">
      {items.map((item, index) => (
        <li key={index} className="relative flex gap-4 pb-6 last:pb-0">
          {index < items.length - 1 ? (
            <span
              aria-hidden
              className="absolute top-8 bottom-0 left-[0.9375rem] w-px bg-border"
            />
          ) : null}
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-card type-label text-foreground">
            {index + 1}
          </span>
          <div className="flex min-w-0 flex-col gap-1.5 pt-1">
            <p className="type-label text-foreground">{item.title}</p>
            {item.body ? (
              <div className="flex flex-col gap-2 type-body text-text-secondary [&_strong]:text-foreground">
                {item.body}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** A value to copy as is: the connector URL, a command. */
export function Copyable({ value, label }: { value: string; label?: string }) {
  return (
    <CodeBlock aria-label={label}>
      <CodeBlockContent wrap>{value}</CodeBlockContent>
      <CodeBlockActions>
        <CodeBlockCopyButton value={value} />
      </CodeBlockActions>
    </CodeBlock>
  )
}

/** Alternatives side by side, such as one tab per platform. */
export function PlatformTabs({
  tabs,
}: {
  tabs: { id: string; label: string; body: ReactNode }[]
}) {
  return (
    <Tabs defaultValue={tabs[0]?.id} className="gap-4">
      <TabsList
        variant="line"
        className="h-10 w-full justify-start overflow-x-auto overflow-y-hidden border-b"
      >
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className="flex-none px-3">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        // Kept mounted (hidden) so "Copy page" includes every platform, not only the open tab.
        <TabsContent
          key={tab.id}
          value={tab.id}
          keepMounted
          data-tab-label={tab.label}
          className="flex flex-col gap-4 data-hidden:hidden"
        >
          {tab.body}
        </TabsContent>
      ))}
    </Tabs>
  )
}

/** A compact two-or-more column reference table that scrolls sideways on a phone. */
export function RefTable({
  head,
  rows,
}: {
  head: string[]
  rows: ReactNode[][]
}) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[32rem] border-collapse text-left type-body">
        <thead className="bg-card">
          <tr>
            {head.map((cell) => (
              <th
                key={cell}
                scope="col"
                className="px-4 py-2.5 type-label text-text-secondary"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t align-top">
              {row.map((cell, at) => (
                <td
                  key={at}
                  className="px-4 py-2.5 text-text-secondary [&_code]:text-foreground"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Inline code: a tool name, a path, a field. */
export function C({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md border bg-card px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </code>
  )
}

/** An example prompt, the way it is typed into Claude. */
export function Prompt({ children }: { children: ReactNode }) {
  return (
    <p
      data-md-prompt
      className="rounded-xl border bg-card px-4 py-3 type-body text-foreground before:mr-2 before:text-text-faint before:content-['›']"
    >
      {children}
    </p>
  )
}
