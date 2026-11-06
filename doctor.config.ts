import { defineConfig } from "react-doctor/api"

// `pnpm doctor`. Each suppression below is a decision, not noise: the reason sits next to it.
export default defineConfig({
  ignore: {
    // shadcn's generated components: reinstalled with the CLI, never edited by hand.
    files: ["src/components/ui/**"],
    overrides: [
      {
        // Writes run one by one inside a Dexie transaction on purpose, so records and their outbox
        // events land in a fixed order and roll back together.
        files: ["src/lib/domain/**", "src/lib/repositories/**"],
        rules: [
          "react-doctor/async-await-in-loop",
          "react-doctor/server-sequential-independent-await",
        ],
      },
      {
        // Recharts is only reached from /summary, and Next already splits it into that route.
        files: ["src/components/summary/**"],
        rules: ["react-doctor/prefer-dynamic-import"],
      },
      {
        // Whether onboarding is done lives in IndexedDB, which the server can't read.
        files: ["src/components/app/app-shell.tsx"],
        rules: ["react-doctor/nextjs-no-client-side-redirect"],
      },
      {
        // Dates are formatted only after the IndexedDB read, so never in the server HTML.
        files: [
          "src/components/home/home-screen.tsx",
          "src/components/accounts/manage-dialogs.tsx",
          "src/components/transactions/movement-detail.tsx",
        ],
        rules: ["react-doctor/no-locale-format-in-render"],
      },
      {
        // The amount field takes focus as the editor opens, as the iOS keypad does.
        files: ["src/components/movement-editor/editor-fields.tsx"],
        rules: ["react-doctor/no-autofocus"],
      },
      {
        // `.includes` here searches a string, or the two chosen currencies; no list to index.
        files: [
          "src/components/movement-editor/pickers.tsx",
          "src/components/onboarding/onboarding-flow.tsx",
          "src/lib/domain/overviews.ts",
        ],
        rules: ["react-doctor/js-set-map-lookups"],
      },
      {
        // Placeholder rows that never reorder.
        files: ["src/components/kw/skeletons.tsx"],
        rules: ["react-doctor/no-array-index-as-key"],
      },
    ],
  },
})
