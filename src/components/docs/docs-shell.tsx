"use client"

import { ArrowLeftIcon, ArrowRightIcon, MenuIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { KWLogo } from "@/components/kw/kw-icon"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { API_URL } from "@/lib/api/client"
import { useI18n } from "@/lib/i18n"
import { cn } from "cn"

import { docsPages, type DocPage, type Lang } from "./content"
import { CopyPage } from "./copy-page"

const UI = {
  en: {
    docs: "Docs",
    onThisPage: "On this page",
    previous: "Previous",
    next: "Next",
    open: "Open Keepwell",
    menu: "Documentation menu",
    language: "Language",
  },
  es: {
    docs: "Documentación",
    onThisPage: "En esta página",
    previous: "Anterior",
    next: "Siguiente",
    open: "Abrir Keepwell",
    menu: "Menú de la documentación",
    language: "Idioma",
  },
} satisfies Record<Lang, Record<string, string>>

const href = (slug: string) => (slug ? `/docs/${slug}` : "/docs")

/**
 * The docs site: a top bar, the pages grouped in a sidebar (a sheet on a phone), the article, an
 * "on this page" list that follows the scroll on wide screens, and previous / next at the end.
 * ?lang=es|en opens a page in that language (for shared links); otherwise it follows the app's.
 */
export function DocsShell({ slug }: { slug: string }) {
  const { locale, setLocale } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  // ?lang= is read after hydration, so the server renders the whole page (in English) for crawlers
  // and assistants that fetch it, instead of an empty shell.
  const [requested, setRequested] = useState<Lang>()
  useEffect(() => {
    const value = new URLSearchParams(location.search).get("lang")
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the query is only known in the browser
    if (value === "es" || value === "en") setRequested(value)
  }, [pathname])
  const lang: Lang = requested ?? (locale.startsWith("es") ? "es" : "en")
  const ui = UI[lang]
  const pages = docsPages(lang, {
    mcpUrl: API_URL ? `${API_URL}/mcp` : undefined,
  })
  const index = Math.max(
    0,
    pages.findIndex((page) => page.slug === slug)
  )
  const page = pages[index]!
  const previous = pages[index - 1]
  const next = pages[index + 1]

  const pickLanguage = (code: Lang) => {
    setLocale(code)
    // Drop ?lang so the choice above, kept by the app, applies to every page.
    if (requested) {
      setRequested(undefined)
      router.replace(pathname)
    }
  }

  return (
    <div lang={lang} className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 lg:px-6">
          <Sheet>
            <SheetTrigger
              className="-ml-2 flex size-10 items-center justify-center rounded-lg hover:bg-card lg:hidden"
              aria-label={ui.menu}
            >
              <MenuIcon className="size-5" aria-hidden />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 overflow-y-auto p-4">
              <SheetTitle className="sr-only">{ui.menu}</SheetTitle>
              <Nav pages={pages} current={page.slug} />
            </SheetContent>
          </Sheet>
          <Link
            href="/docs"
            className="flex items-center gap-2.5"
            aria-label="Keepwell"
          >
            <KWLogo height={24} />
          </Link>
          <span className="type-label text-text-secondary">{ui.docs}</span>
          <div className="ml-auto flex items-center gap-3">
            <nav
              aria-label={ui.language}
              className="flex gap-1 rounded-lg border p-0.5 type-caption"
            >
              {(["en", "es"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  lang={code}
                  aria-pressed={code === lang}
                  onClick={() => pickLanguage(code)}
                  className={cn(
                    "rounded-md px-2 py-1",
                    code === lang
                      ? "bg-card font-semibold text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {code === "en" ? "EN" : "ES"}
                </button>
              ))}
            </nav>
            <Link
              href="/"
              className="hidden rounded-lg bg-primary px-3 py-1.5 type-label text-primary-foreground hover:opacity-90 sm:inline-flex"
            >
              {ui.open}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-10 px-4 lg:px-6">
        <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-60 shrink-0 overflow-y-auto py-8 lg:block">
          <Nav pages={pages} current={page.slug} />
        </aside>

        <main className="min-w-0 flex-1 py-8 lg:py-10">
          <article
            id="doc-article"
            className="mx-auto flex max-w-3xl flex-col gap-10"
          >
            <header className="flex flex-col gap-3 border-b pb-8">
              <div className="flex items-center justify-between gap-3">
                <p className="type-label text-brand-600 dark:text-brand-500">
                  {page.group}
                </p>
                <div data-md-skip>
                  <CopyPage lang={lang} />
                </div>
              </div>
              <h1 className="type-title">{page.title}</h1>
              <p className="type-heading font-normal text-text-secondary">
                {page.description}
              </p>
            </header>
            {page.sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="flex scroll-mt-20 flex-col gap-4 type-body leading-relaxed [&_a]:text-link [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-link-hover [&_li]:ml-5 [&_ol>li]:list-decimal [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2 [&_ul>li]:list-disc"
              >
                <h2 className="group type-heading">
                  <a
                    href={`#${section.id}`}
                    className="!text-foreground !no-underline"
                  >
                    {section.title}
                    <span
                      aria-hidden
                      className="ml-2 text-text-faint opacity-0 group-hover:opacity-100"
                    >
                      #
                    </span>
                  </a>
                </h2>
                {section.body}
              </section>
            ))}
            <PrevNext previous={previous} next={next} ui={ui} />
          </article>
        </main>

        <OnThisPage page={page} title={ui.onThisPage} />
      </div>
    </div>
  )
}

function Nav({ pages, current }: { pages: DocPage[]; current: string }) {
  const groups = [...new Set(pages.map((page) => page.group))]
  return (
    <nav className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group} className="flex flex-col gap-1">
          <p className="px-3 pb-1 type-caption font-semibold text-foreground">
            {group}
          </p>
          {pages
            .filter((page) => page.group === group)
            .map((page) => (
              <Link
                key={page.slug}
                href={href(page.slug)}
                aria-current={page.slug === current ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1.5 type-body transition-colors",
                  page.slug === current
                    ? "bg-brand-600/10 font-medium text-brand-600 dark:text-brand-500"
                    : "text-text-secondary hover:bg-card hover:text-foreground"
                )}
              >
                {page.title}
              </Link>
            ))}
        </div>
      ))}
    </nav>
  )
}

/** The page's sections, the one being read marked; only on wide screens. */
function OnThisPage({ page, title }: { page: DocPage; title: string }) {
  const [active, setActive] = useState(page.sections[0]?.id)
  const key = page.sections.map((section) => section.id).join()

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          )[0]
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: "-80px 0px -65% 0px" }
    )
    for (const id of key.split(",")) {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [key])

  return (
    <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-52 shrink-0 py-10 xl:block">
      <p className="pb-3 type-caption font-semibold text-foreground">{title}</p>
      <ul className="flex flex-col gap-2 border-l">
        {page.sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className={cn(
                "-ml-px block border-l py-0.5 pl-3 type-caption",
                active === section.id
                  ? "border-brand-600 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {section.title}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  )
}

function PrevNext({
  previous,
  next,
  ui,
}: {
  previous: DocPage | undefined
  next: DocPage | undefined
  ui: (typeof UI)[Lang]
}) {
  if (!previous && !next) return null
  return (
    <nav className="grid gap-3 border-t pt-8 sm:grid-cols-2">
      {previous ? (
        <Link
          href={href(previous.slug)}
          className="flex flex-col gap-1 rounded-xl border p-4 hover:bg-card"
        >
          <span className="flex items-center gap-1 type-caption text-muted-foreground">
            <ArrowLeftIcon className="size-3.5" aria-hidden /> {ui.previous}
          </span>
          <span className="type-label">{previous.title}</span>
        </Link>
      ) : (
        <span className="hidden sm:block" />
      )}
      {next ? (
        <Link
          href={href(next.slug)}
          className="flex flex-col items-end gap-1 rounded-xl border p-4 text-right hover:bg-card"
        >
          <span className="flex items-center gap-1 type-caption text-muted-foreground">
            {ui.next} <ArrowRightIcon className="size-3.5" aria-hidden />
          </span>
          <span className="type-label">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  )
}
