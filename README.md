# Keepwell for the web

The desktop (and phone-width) version of Keepwell, with the same features, rules and texts as the iOS
app. Your data lives in this browser (IndexedDB) and works offline as an installable PWA. An optional
Keepwell account (invite-only) syncs it with the iPhone; without one it stays in this browser, and CSV
export and import are the manual way to keep or move a copy.

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build && pnpm start   # production, with the offline service worker
```

Brand logos (Brandfetch's Logo API, linked live) need `NEXT_PUBLIC_BRANDFETCH_CLIENT_ID` at build time,
set to the account's public client id (`1idMF4-f4zDduiiadcZ`, not its secret API key). Without it, or with
`BRAND_LOGOS_ENABLED` off in `src/lib/presentation/brand-logos.ts`, the app makes no request to
Brandfetch and known brands show a monogram. The same client id drives the "Business" field's brand search
(`api.brandfetch.io/v2/search`, `src/lib/presentation/brand-search.ts`): called from the browser, debounced,
only with what the person types in that field and only when none of their merchants or the brand table
matches. Brandfetch then sees that text and the device's IP address; the privacy policy has to say so.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test         # Vitest: the iOS domain tests, ported, plus string coverage
pnpm tokens:check # design tokens still match keepwell-ios
```

`keepwell-ios` must sit next to this folder for `tokens:*`.

## Where things live

- `src/lib/domain`: the iOS domain ported to TypeScript (money in exact decimals, balances, net worth,
  monthly summary, billing cycles, categories, accounts and cards, movements, onboarding, CSV,
  formatting). Pure functions and use cases over a `LedgerStore`; `tests/domain` ports the iOS tests.
- `src/lib/repositories`, `src/lib/db`: IndexedDB through Dexie, with audit columns, tombstones and a
  sync outbox; `ledgerStore` implements the domain contract.
- `src/lib/presentation/brands`: the brand table (`brands.json`) and the matching cases, both copied
  verbatim to keepwell-ios; `tests/brands.test.ts` compares them when `../keepwell-ios` (or
  `KEEPWELL_IOS`) is there.
- `src/lib/i18n`: `strings.json` holds the texts of the iOS `Localizable.xcstrings` catalogs, copied
  by hand when iOS adds or changes one; `web-strings*.ts` holds the few desktop-only texts, in English and Spanish.
- `src/app/tokens.css`: generated from the iOS DesignSystem (`pnpm tokens:sync`). The iOS type scale is
  available as `type-*` utilities (`type-title`, `type-label`, …).
- `src/components`: screens by feature on shadcn components (`ui/`, untouched) and Keepwell wrappers
  (`kw/`).

## Keyboard

`⌘K` command palette · `N` new movement (`E` expense, `I` income, `T` transfer) · `1`–`4` or `G` then a
letter for the sections · `,` settings · `/` search · `⌘B` sidebar · `?` all shortcuts.
