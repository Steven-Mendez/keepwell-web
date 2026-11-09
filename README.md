# Keepwell for the web

The desktop (and phone-width) version of Keepwell, with the same features, rules and texts as the iOS
app. Your data lives in this browser (IndexedDB), works offline as an installable PWA, and moves to
and from the iPhone with the shared `.json` backup.

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build && pnpm start   # production, with the offline service worker
```

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
- `src/lib/i18n`: `strings.json` holds the texts of the iOS `Localizable.xcstrings` catalogs, copied
  by hand when iOS adds or changes one; `web-strings*.ts` holds the few desktop-only texts, in English and Spanish.
- `src/app/tokens.css`: generated from the iOS DesignSystem (`pnpm tokens:sync`). The iOS type scale is
  available as `type-*` utilities (`type-title`, `type-label`, …).
- `src/components`: screens by feature on shadcn components (`ui/`, untouched) and Keepwell wrappers
  (`kw/`).

## Keyboard

`⌘K` command palette · `N` new movement (`E` expense, `I` income, `T` transfer) · `1`–`4` or `G` then a
letter for the sections · `,` settings · `/` search · `⌘B` sidebar · `?` all shortcuts.
