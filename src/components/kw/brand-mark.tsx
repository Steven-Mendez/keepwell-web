"use client"

import { useState } from "react"

import { CategoryBadge } from "@/components/kw/primitives"
import { categoryColor } from "@/lib/presentation/display"
import { brandFor, brandMonogram } from "@/lib/presentation/brands"
import type { LogoSubject } from "@/lib/presentation/merchants"
import { brandLogoSession, type BrandLogoEvent } from "@/lib/presentation/brand-logos"
import type { TransactionCategory } from "@/lib/schema"
import { cn } from "@/lib/utils"

/**
 * A rule's or movement's leading badge: its merchant's logo when given (`logo`), else the brand its
 * text names, if the table knows one, else the category's symbol. Only a domain is ever requested;
 * the text never leaves the device.
 */
export function BrandOrCategoryBadge({
  text,
  category,
  logo,
  size = "md",
}: {
  text: string
  category: TransactionCategory | undefined
  logo?: LogoSubject | undefined
  size?: "sm" | "md"
}) {
  const brand = logo ?? brandFor(text)
  if (!brand) return <CategoryBadge category={category} size={size} />
  return <BrandMark brand={brand} color={categoryColor(category)} size={size} />
}

/**
 * A known brand's mark in the row's 40 px badge: the monogram (its initial on the category's color)
 * paints at once, and Brandfetch's logo covers it once it has loaded. If the logo fails, the
 * monogram stays: no gap, no broken image, no jump, since both share one neutral circle.
 */
export function BrandMark({
  brand,
  color,
  size = "md",
  className,
}: {
  /** A table brand or a merchant: the name its monogram comes from and the domain of its logo. */
  brand: LogoSubject
  /** The category's CSS color, for the monogram. */
  color: string
  size?: "sm" | "md"
  className?: string
}) {
  // How this brand's logo ended; a different brand (the row now shows another rule) starts over.
  const [result, setResult] = useState<{ domain: string; loaded: boolean } | undefined>(undefined)
  const settled = result?.domain === brand.domain ? result : undefined
  const loaded = settled?.loaded === true
  // Asked on every render: a domain that failed in another row is not requested here.
  const light = brandLogoSession.logoURL(brand.domain, "light")
  const dark = brandLogoSession.logoURL(brand.domain, "dark")

  const settle = (event: BrandLogoEvent) => {
    const online = typeof navigator === "undefined" || navigator.onLine
    setResult({ domain: brand.domain, loaded: brandLogoSession.record(brand.domain, event, online) })
  }

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary",
        size === "sm" ? "size-8" : "size-10",
        className
      )}
      aria-hidden
    >
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center font-bold",
          size === "sm" ? "type-label" : "type-body"
        )}
        style={{ color, backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)` }}
      >
        {brandMonogram(brand)}
      </span>
      {light && dark && settled?.loaded !== false ? (
        <picture key={brand.domain} className="absolute inset-0">
          <source media="(prefers-color-scheme: dark)" srcSet={dark} />
          {/* A plain <img>, never next/image: Brandfetch must be linked directly, and the optimizer would fetch it from our server. */}
          <img
            src={light}
            alt=""
            width={128}
            height={128}
            loading="lazy"
            decoding="async"
            // One of the policies Brandfetch accepts: it sends this site's origin, never the page's path.
            referrerPolicy="strict-origin-when-cross-origin"
            className={cn("size-full object-cover transition-opacity duration-200", loaded ? "opacity-100" : "opacity-0")}
            // A logo already in the browser's cache can finish before React listens.
            ref={(image) => {
              if (image?.complete && image.naturalWidth > 0 && !loaded) settle({ type: "load", naturalWidth: image.naturalWidth })
            }}
            onLoad={(event) => settle({ type: "load", naturalWidth: event.currentTarget.naturalWidth })}
            onError={() => settle({ type: "error" })}
          />
        </picture>
      ) : null}
    </span>
  )
}
