# Keepwell web design language

The iOS app (keepwell-ios `Packages/DesignSystem`) is the source of truth for the look: colors,
type, radii, icons and the role of each component. The web takes that language and optimizes it for
a desktop browser: wider layouts, hover and focus states, keyboard shortcuts shown in tooltips,
side panels instead of pushed screens, denser rows. It never adds a look of its own and never shows
stock shadcn styling on screen.

## Rules

1. **Build screens from `src/components/kw`**, the web versions of the iOS KW* views:
   - `design.tsx`: `KWButton`/`KWButtonLink` (KWButtonStyle roles: `primary` white pill, `secondary`,
     `surface`, `destructive`, `link`, `plain`; sizes `large`…`mini`), `KWCircleButton` (40 px round,
     `surface` or `white` "+"), `KWActionButton` (48 px circle + caption), `KWSegmented`
     (`large`/`compact`/`accent`), `KWChip` (filter pills), `KWLargeTitleHeader`, `KWSection` /
     `KWSectionHeader` / `KWTextAction` ("+ Add"), `KWGroupedCard` + `KWValueRow`, `KWEmptyState`,
     `KWTransactionIcon`.
   - `kw-icon.tsx`: `KWIcon` (the iOS stroke icons, generated from Swift), `KWLogoMark`,
     `KWAppIconTile`, `KWMiniCard`.
   - `primitives.tsx`: `Page`, `CardArt`, `CategoryBadge`, `Amount`, `DetailRow`.
   - `transaction-row.tsx`: `TransactionRow` (KWTransactionRow: kind icon, kind color).
2. **Icons**: `KWIcon` when iOS has the glyph (home, list, tabAccounts, chartBars, settings, plus,
   search, close, chevronLeft/Right, pencil, trash, transfer, arrowUpRight, arrowDownLeft, clock,
   creditCard, cash, bank, wallet, eye, eyeOff, download, share, check, more…). Lucide only where
   iOS uses an SF Symbol (category icons) or has nothing equivalent.
3. **Color roles** (tokens, never raw hex): screens on `bg-background` (black); groups on `bg-card`
   (`surface`), controls inside them on `bg-secondary` (`surface2`); `text-foreground`,
   `text-text-secondary`, `text-muted-foreground`, `text-text-faint`; dividers `divide-divider`.
   Movement colors: expense `text-negative` (soft coral, never alarm red), income `text-positive`,
   transfer neutral, planned `text-pending`. Headline totals stay white. Brand blue only for the
   logo tile, accents (`ring`, `link`) and charts.
4. **Type**: only the `type-*` scale (`type-title` screen titles, `type-heading`, `type-body`,
   `type-label`, `type-caption`, `type-micro`, `type-amount-lg`, `type-display`). Never Tailwind
   `text-sm`/`text-lg` for sizes.
5. **Shapes**: buttons, chips and segmented controls are pills (`rounded-full`); grouped cards
   `rounded-2xl` (20 px, KWRadius.surface); card art 18 px; inputs 12 px.
6. **Structure of a screen**: `KWLargeTitleHeader` (title + subtitle + trailing `KWCircleButton`s or
   a primary `KWButton`), then sections: `KWSection title=… action=<KWTextAction>` over a
   `KWGroupedCard`. Settings-like lists are `KWValueRow`s. Empty lists use `KWEmptyState` with the
   iOS text and a primary button.
7. **Web optimizations**: two columns from `lg` (list + side panel, like Revolut web); every
   clickable row has hover (`hover:bg-secondary/50`) and a visible focus ring; tooltips name the
   shortcut; dialogs instead of full-screen sheets on desktop, full screen on phones; the primary
   action of a dialog is a white `KWButton` aligned right, the secondary a `plain` one.
8. **shadcn stays underneath** for behavior (Dialog, Sheet, Select, Combobox, DropdownMenu,
   Tooltip, Popover). Restyle what shows: pass Keepwell classes, or wrap it in `kw/`. Never edit
   `src/components/ui`.
9. **Text**: iOS catalog keys through `t.in(ns, key)`; web-only text in `web-strings*.ts` with `es`.
