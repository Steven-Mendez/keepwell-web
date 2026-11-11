"use client"

import {
  ChevronDownIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileTextIcon,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/toast"

import type { Lang } from "./content"
import { articleToMarkdown } from "./markdown"

const TEXT = {
  en: {
    copy: "Copy page",
    copyMarkdown: "Copy as Markdown",
    copyHint: "For pasting into an AI assistant",
    view: "View as Markdown",
    viewHint: "Plain text of this page",
    openClaude: "Open in Claude",
    openChatGPT: "Open in ChatGPT",
    askHint: "Ask about this page",
    copied: "Page copied as Markdown",
    failed: "Couldn't copy the page",
    prompt: (url: string) => `Read ${url} so I can ask you questions about it.`,
  },
  es: {
    copy: "Copiar página",
    copyMarkdown: "Copiar como Markdown",
    copyHint: "Para pegarla en un asistente de IA",
    view: "Ver como Markdown",
    viewHint: "Texto plano de esta página",
    openClaude: "Abrir en Claude",
    openChatGPT: "Abrir en ChatGPT",
    askHint: "Pregunta sobre esta página",
    copied: "Página copiada como Markdown",
    failed: "No se pudo copiar la página",
    prompt: (url: string) =>
      `Lee ${url} para que pueda hacerte preguntas sobre ella.`,
  },
} satisfies Record<Lang, Record<string, unknown>>

function markdown(): string {
  const article = document.getElementById("doc-article")
  return article ? articleToMarkdown(article, location.origin) : ""
}

function Row({ title, hint }: { title: string; hint: string }) {
  return (
    <span className="flex flex-col">
      <span className="type-label text-foreground">{title}</span>
      <span className="type-caption text-muted-foreground">{hint}</span>
    </span>
  )
}

/**
 * The page for an AI assistant: copied or shown as Markdown, or opened in Claude or ChatGPT with a
 * prompt to read it. The assistants fetch the page itself; its HTML carries the full text.
 */
export function CopyPage({ lang }: { lang: Lang }) {
  const t = TEXT[lang]

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown())
      toast.add({ title: t.copied })
    } catch {
      toast.add({ title: t.failed, type: "error" })
    }
  }

  const view = () => {
    const blob = new Blob([markdown()], { type: "text/plain;charset=utf-8" })
    window.open(URL.createObjectURL(blob), "_blank", "noopener")
  }

  // The page's own address, in the language being read.
  const pageUrl = () => `${location.origin}${location.pathname}?lang=${lang}`
  const ask = (base: string) =>
    window.open(
      `${base}${encodeURIComponent(t.prompt(pageUrl()))}`,
      "_blank",
      "noopener"
    )

  const item =
    "items-start gap-2.5 px-2 py-2 [&_svg]:mt-0.5 [&_svg]:text-text-faint"

  return (
    <div className="flex shrink-0 overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={() => void copy()}
        className="flex h-8 items-center gap-1.5 px-2.5 type-caption text-text-secondary hover:bg-card hover:text-foreground"
      >
        <CopyIcon className="size-3.5" aria-hidden />
        {t.copy}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex h-8 items-center border-l px-1.5 text-text-secondary hover:bg-card hover:text-foreground"
          aria-label={t.copy}
        >
          <ChevronDownIcon className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="min-w-64 rounded-xl p-1.5"
        >
          <DropdownMenuGroup>
            <DropdownMenuItem className={item} onClick={() => void copy()}>
              <CopyIcon className="size-4" aria-hidden />
              <Row title={t.copyMarkdown} hint={t.copyHint} />
            </DropdownMenuItem>
            <DropdownMenuItem className={item} onClick={view}>
              <FileTextIcon className="size-4" aria-hidden />
              <Row title={t.view} hint={t.viewHint} />
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator className="my-1.5" />
          <DropdownMenuGroup>
            <DropdownMenuItem
              className={item}
              onClick={() => ask("https://claude.ai/new?q=")}
            >
              <ExternalLinkIcon className="size-4" aria-hidden />
              <Row title={t.openClaude} hint={t.askHint} />
            </DropdownMenuItem>
            <DropdownMenuItem
              className={item}
              onClick={() => ask("https://chatgpt.com/?q=")}
            >
              <ExternalLinkIcon className="size-4" aria-hidden />
              <Row title={t.openChatGPT} hint={t.askHint} />
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
