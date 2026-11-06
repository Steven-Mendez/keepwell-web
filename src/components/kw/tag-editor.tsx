"use client"

import { XIcon } from "lucide-react"
import { useState } from "react"

import { Input } from "@/components/ui/input"
import { mergeTags, normalizedTag, tagSuggestions } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/** "#viaje-méxico", the way people type a tag (iOS `TagDisplay.label`). */
export function tagLabel(tag: string): string {
  return `#${tag}`
}

/** "#boda #viaje" for a row's subtitle; `undefined` without tags. */
export function tagLine(tags: readonly string[] | undefined): string | undefined {
  return tags && tags.length > 0 ? tags.map(tagLabel).join(" ") : undefined
}

/** A tag as a pill: clickable to filter by it, or with an × to remove it in an editor (iOS `TagChip`). */
export function TagChip({ tag, onClick, onRemove, muted, className }: { tag: string; onClick?: () => void; onRemove?: () => void; muted?: boolean; className?: string }) {
  const t = useT()
  const pill = cn(
    "inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-secondary px-3 type-label outline-none transition-colors",
    muted ? "text-text-secondary" : "text-foreground",
    onClick && "hover:bg-secondary/70 focus-visible:ring-2 focus-visible:ring-ring",
    onRemove && "pr-1.5",
    className,
  )
  const label = <span className="truncate">{tagLabel(tag)}</span>
  if (!onRemove) {
    return onClick ? (
      <button type="button" onClick={onClick} className={pill}>
        {label}
      </button>
    ) : (
      <span className={pill}>{label}</span>
    )
  }
  return (
    <span className={pill}>
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t.in("sharedpresentation", "Remove %@", tagLabel(tag))}
        className="grid size-5 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <XIcon className="size-3" aria-hidden />
      </button>
    </span>
  )
}

/**
 * Adds and removes tags as "#chips" (iOS `TagEditor`): type one and press Enter, or pick one already
 * used (most used first). Tags are normalized as they're added, so "#Viaje México" becomes "#viaje-méxico".
 */
export function TagEditor({ tags, onChange, usage, id }: { tags: readonly string[]; onChange: (tags: string[]) => void; usage: readonly string[]; id?: string }) {
  const t = useT()
  const [text, setText] = useState("")
  const suggestions = tagSuggestions(usage, text, tags, 6)
  const canAdd = normalizedTag(text) !== undefined

  function add(raw: string) {
    onChange(mergeTags(tags, [raw]))
    setText("")
  }

  return (
    <div className="flex flex-col gap-2">
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <TagChip key={tag} tag={tag} onRemove={() => onChange(tags.filter((other) => other !== tag))} />
          ))}
        </div>
      ) : null}
      <div className="flex h-10 items-center gap-2 rounded-xl bg-secondary px-3.5">
        <span className="type-body font-semibold text-muted-foreground" aria-hidden>
          #
        </span>
        <Input
          id={id}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Enter adds the tag instead of submitting the form; ⌘↩ still saves.
            if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
              event.preventDefault()
              if (canAdd) add(text)
            } else if (event.key === "Backspace" && text === "" && tags.length > 0) {
              onChange(tags.slice(0, -1))
            }
          }}
          placeholder={t.in("sharedpresentation", "Add a tag")}
          aria-label={t.in("sharedpresentation", "Add a tag")}
          autoComplete="off"
          autoCapitalize="none"
          className="h-9 border-0 bg-transparent px-0 type-body shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        {canAdd ? (
          <button type="button" onClick={() => add(text)} className="shrink-0 rounded-md type-label text-link outline-none hover:text-link-hover focus-visible:ring-2 focus-visible:ring-ring">
            {t.in("sharedpresentation", "Add")}
          </button>
        ) : null}
      </div>
      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((tag) => (
            <TagChip key={tag} tag={tag} muted onClick={() => add(tag)} className="border border-dashed border-border bg-transparent" />
          ))}
        </div>
      ) : null}
    </div>
  )
}
