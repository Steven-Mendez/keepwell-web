import Link from "next/link"
import type { ReactNode } from "react"

import {
  C,
  Callout,
  Copyable,
  PlatformTabs,
  Prompt,
  RefTable,
  Steps,
} from "./parts"

/**
 * The Keepwell docs, in English and Spanish. Written from what the code does: keep them in step with
 * keepwell-api/src/entrypoints/mcp (tools, views) and the consent screen (/connect). A new tool, scope
 * or limit belongs here too.
 */

export type Lang = "en" | "es"

export interface DocSection {
  id: string
  title: string
  body: ReactNode
}

export interface DocPage {
  /** "" is the docs home, /docs. */
  slug: string
  group: string
  title: string
  description: string
  sections: DocSection[]
}

/** What a page needs from the outside: the connector URL depends on the deployment. */
export interface DocsInput {
  mcpUrl: string | undefined
}

const READ_TOOLS = [
  "get_financial_context",
  "list_accounts",
  "get_net_worth",
  "get_monthly_summary",
  "get_trends",
  "get_upcoming_payments",
  "search_transactions",
]

export function docsPages(lang: Lang, { mcpUrl }: DocsInput): DocPage[] {
  const url = mcpUrl ? <Copyable value={mcpUrl} label="Connector URL" /> : null
  const command = mcpUrl ? (
    <Copyable value={`claude mcp add --transport http keepwell ${mcpUrl}`} />
  ) : null
  return lang === "es"
    ? spanish(url, command, mcpUrl)
    : english(url, command, mcpUrl)
}

function english(
  url: ReactNode,
  command: ReactNode,
  mcpUrl: string | undefined
): DocPage[] {
  const noServer = (
    <Callout kind="warning">
      This build of Keepwell has no server, so it has no connector.
    </Callout>
  )
  return [
    {
      slug: "",
      group: "Get started",
      title: "Keepwell for Claude",
      description:
        "Ask Claude about your money in plain words. Keepwell's MCP connector lets Claude read your accounts and movements, show them as interactive views, and propose movements that you confirm.",
      sections: [
        {
          id: "what-it-does",
          title: "What it does",
          body: (
            <>
              <p>
                Keepwell has an <strong>MCP connector</strong> (Model Context
                Protocol, the open standard Claude uses to talk to other apps).
                Once you connect it, Claude can answer questions about your
                finances with your real numbers, in either of your currencies.
              </p>
              <ul>
                <li>
                  <strong>Read:</strong> accounts and balances, net worth, a
                  month by category, budgets, trends, upcoming payments and card
                  due dates, and a search over your movements.
                </li>
                <li>
                  <strong>See:</strong> in Claude, summaries, trends and
                  upcoming payments open as interactive views you can expand and
                  adjust.
                </li>
                <li>
                  <strong>Record, with your OK:</strong> Claude can propose a
                  movement or a recurring payment. It waits as pending until you
                  confirm it in Keepwell.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "how-it-works",
          title: "How it works",
          body: (
            <Steps
              items={[
                {
                  title: "You add Keepwell to Claude as a connector",
                  body: (
                    <p>
                      Once, on the web or the desktop app. It then shows up on
                      your phone too.
                    </p>
                  ),
                },
                {
                  title: "You sign in to Keepwell and allow access",
                  body: (
                    <p>
                      Claude never sees your password: Keepwell gives it a token
                      you can revoke at any time.
                    </p>
                  ),
                },
                {
                  title:
                    "Claude calls Keepwell's tools when your question needs them",
                  body: (
                    <p>
                      It reads only what the question needs, and shows the
                      result as text or as a view.
                    </p>
                  ),
                },
              ]}
            />
          ),
        },
        {
          id: "requirements",
          title: "Requirements",
          body: (
            <ul>
              <li>
                A Keepwell account. During early access the connector is
                included for every account.
              </li>
              <li>
                Claude on the web, the desktop app or Claude Code, on a plan
                that allows custom connectors. On Team and Enterprise, an
                organization owner adds it.
              </li>
            </ul>
          ),
        },
        {
          id: "next",
          title: "Next",
          body: (
            <p>
              Follow the <Link href="/docs/mcp">quickstart</Link> to connect in
              about two minutes, or see the{" "}
              <Link href="/docs/prompts">example prompts</Link>.
            </p>
          ),
        },
      ],
    },
    {
      slug: "mcp",
      group: "Get started",
      title: "Quickstart",
      description: "Connect Claude to Keepwell in about two minutes.",
      sections: [
        {
          id: "connector-url",
          title: "1. Copy the connector URL",
          body: (
            <>
              <p>
                This is the address Claude connects to. Paste it exactly as it
                is, with no trailing slash.
              </p>
              {url ?? noServer}
            </>
          ),
        },
        {
          id: "add-connector",
          title: "2. Add it to Claude",
          body: (
            <PlatformTabs
              tabs={[
                {
                  id: "web",
                  label: "Web and desktop",
                  body: (
                    <Steps
                      items={[
                        {
                          title: (
                            <>
                              Open <strong>Settings → Connectors</strong>
                            </>
                          ),
                          body: (
                            <p>
                              Then choose <strong>Add custom connector</strong>.
                            </p>
                          ),
                        },
                        {
                          title: (
                            <>
                              Name it <strong>Keepwell</strong> and paste the
                              URL
                            </>
                          ),
                          body: (
                            <p>Leave the advanced settings empty and add it.</p>
                          ),
                        },
                        {
                          title: (
                            <>
                              Click <strong>Connect</strong>
                            </>
                          ),
                          body: (
                            <p>
                              Keepwell opens in a new window. Sign in with Apple
                              or your passkey.
                            </p>
                          ),
                        },
                        {
                          title: (
                            <>
                              Review the request and click{" "}
                              <strong>Allow</strong>
                            </>
                          ),
                          body: (
                            <p>
                              Claude asks to read your data and, if it asks to
                              record, to propose movements.
                            </p>
                          ),
                        },
                      ]}
                    />
                  ),
                },
                {
                  id: "mobile",
                  label: "iPhone and Android",
                  body: (
                    <>
                      <p>
                        Connectors are added on the web or the desktop app. Once
                        added, Keepwell shows up in the Claude app on your
                        phone, with the same account.
                      </p>
                      <Callout kind="tip">
                        On your phone, open the tools menu in a chat to check
                        that Keepwell is on.
                      </Callout>
                    </>
                  ),
                },
                {
                  id: "code",
                  label: "Claude Code",
                  body: (
                    <>
                      <p>In a terminal:</p>
                      {command}
                      <p>
                        Then, inside Claude Code, type <C>/mcp</C>, choose{" "}
                        <strong>keepwell</strong> and sign in in the browser.
                        More in{" "}
                        <Link href="/docs/claude-code">Claude Code</Link>.
                      </p>
                    </>
                  ),
                },
              ]}
            />
          ),
        },
        {
          id: "try-it",
          title: "3. Try it",
          body: (
            <>
              <p>In a new chat, turn Keepwell on in the tools menu and ask:</p>
              <Prompt>How am I doing this month?</Prompt>
              <p>
                Claude answers with your numbers and shows the month as an
                interactive view.
              </p>
            </>
          ),
        },
      ],
    },
    {
      slug: "claude-code",
      group: "Get started",
      title: "Claude Code",
      description:
        "Use Keepwell from the terminal, with the same account and permissions.",
      sections: [
        {
          id: "add",
          title: "Add the server",
          body: (
            <>
              {command ?? noServer}
              <p>
                This adds Keepwell for your user. Add <C>--scope project</C> to
                share it with a project through <C>.mcp.json</C>.
              </p>
            </>
          ),
        },
        {
          id: "sign-in",
          title: "Sign in",
          body: (
            <Steps
              items={[
                {
                  title: (
                    <>
                      Type <C>/mcp</C> in Claude Code
                    </>
                  ),
                },
                {
                  title: (
                    <>
                      Choose <strong>keepwell</strong> and{" "}
                      <strong>Authenticate</strong>
                    </>
                  ),
                  body: <p>Your browser opens Keepwell&rsquo;s sign-in.</p>,
                },
                {
                  title: <>Allow access</>,
                  body: (
                    <p>
                      Back in the terminal, the server shows as connected with
                      its tools.
                    </p>
                  ),
                },
              ]}
            />
          ),
        },
        {
          id: "remove",
          title: "Remove it",
          body: <Copyable value="claude mcp remove keepwell" />,
        },
      ],
    },
    {
      slug: "prompts",
      group: "Use",
      title: "Example prompts",
      description:
        "Questions that work well. Ask in your own words: Claude picks the tools.",
      sections: [
        {
          id: "overview",
          title: "Overview",
          body: (
            <>
              <Prompt>Give me an overview of my finances.</Prompt>
              <Prompt>
                What&rsquo;s my net worth, and how much of it is in each
                account?
              </Prompt>
            </>
          ),
        },
        {
          id: "spending",
          title: "Spending and budgets",
          body: (
            <>
              <Prompt>
                How am I doing this month? Where did I spend the most?
              </Prompt>
              <Prompt>Which budgets am I close to going over?</Prompt>
              <Prompt>Compare October and November.</Prompt>
            </>
          ),
        },
        {
          id: "trends",
          title: "Trends",
          body: (
            <Prompt>
              Show me how my income and spending changed over the last 6 months.
            </Prompt>
          ),
        },
        {
          id: "upcoming",
          title: "What’s coming",
          body: (
            <>
              <Prompt>
                What payments and card due dates do I have in the next 30 days?
              </Prompt>
              <Prompt>Which subscriptions am I paying for?</Prompt>
            </>
          ),
        },
        {
          id: "search",
          title: "Find movements",
          body: (
            <Prompt>Find everything I spent at restaurants in October.</Prompt>
          ),
        },
        {
          id: "record",
          title: "Record",
          body: (
            <>
              <Prompt>Log a 12.50 USD grocery expense on my debit card.</Prompt>
              <Prompt>
                Set up Netflix as a monthly subscription of 15.49 USD starting
                on the 12th.
              </Prompt>
              <Callout>
                What Claude records waits as pending until you confirm it in
                Keepwell. See{" "}
                <Link href="/docs/security">Security and privacy</Link>.
              </Callout>
            </>
          ),
        },
      ],
    },
    {
      slug: "views",
      group: "Use",
      title: "Interactive views",
      description:
        "In Claude, some answers open as a view you can expand and adjust, drawn from your data.",
      sections: [
        {
          id: "views",
          title: "The views",
          body: (
            <RefTable
              head={["View", "Shown for", "You can"]}
              rows={[
                [
                  "Month summary",
                  <>
                    <C>get_monthly_summary</C>, <C>get_financial_context</C>
                  </>,
                  "See income, spending and net; expand for every category, budgets, accounts and the previous or next month",
                ],
                [
                  "Trends",
                  <C key="t">get_trends</C>,
                  "Switch between 3, 6 and 12 months",
                ],
                [
                  "Upcoming payments",
                  <C key="u">get_upcoming_payments</C>,
                  "Switch between 7, 30 and 90 days",
                ],
                [
                  "Pending movement",
                  <>
                    <C>create_transaction</C>, <C>create_recurring_rule</C>
                  </>,
                  "See what Claude prepared before you confirm it in Keepwell",
                ],
              ]}
            />
          ),
        },
        {
          id: "expand",
          title: "Expanding a view",
          body: (
            <p>
              Click <strong>See all</strong> to open the view full screen, or in
              the side panel where Claude offers one. Click{" "}
              <strong>Collapse</strong> to bring it back into the chat.
            </p>
          ),
        },
        {
          id: "how",
          title: "How they work",
          body: (
            <ul>
              <li>
                The view is part of Keepwell&rsquo;s connector and draws the
                same data Claude receives. It loads nothing from other sites.
              </li>
              <li>
                When you change a period, the view asks Keepwell again through
                Claude, with the same permissions.
              </li>
              <li>
                The view follows Claude&rsquo;s light or dark theme and your
                language.
              </li>
              <li>
                Where an app doesn&rsquo;t support views, Claude still gets the
                same data as text.
              </li>
            </ul>
          ),
        },
      ],
    },
    {
      slug: "tools",
      group: "Reference",
      title: "Tools",
      description:
        "Everything the connector exposes. Amounts are exact decimals with their currency; nothing is ever added across currencies.",
      sections: [
        {
          id: "read",
          title: "Read tools",
          body: (
            <RefTable
              head={["Tool", "Returns", "Arguments"]}
              rows={[
                [
                  <C key="1">get_financial_context</C>,
                  "Currencies, accounts with balances, net worth, this month, budgets, the next 14 days of payments. A good starting point.",
                  "—",
                ],
                [
                  <C key="2">list_accounts</C>,
                  "Accounts with their balance in each currency, credit terms and cards (last four digits only).",
                  "—",
                ],
                [
                  <C key="3">get_net_worth</C>,
                  "Net worth in the principal currency (and the second, at your rate), by account.",
                  "—",
                ],
                [
                  <C key="4">get_monthly_summary</C>,
                  "Income, spending and net for a month, by category, with budgets.",
                  <>
                    <C>month</C> YYYY-MM, this month by default
                  </>,
                ],
                [
                  <C key="5">get_trends</C>,
                  "Income, spending and net for each of the last months.",
                  <>
                    <C>months</C> 1–24, default 6
                  </>,
                ],
                [
                  <C key="6">get_upcoming_payments</C>,
                  "Recurring movements and card due dates from today on.",
                  <>
                    <C>days</C> 1–90, default 30
                  </>,
                ],
                [
                  <C key="7">search_transactions</C>,
                  "Movements, newest first, paged.",
                  <>
                    dates, account, category, kind, currency, status, text,{" "}
                    <C>limit</C> up to 100
                  </>,
                ],
              ]}
            />
          ),
        },
        {
          id: "write",
          title: "Write tools",
          body: (
            <>
              <RefTable
                head={["Tool", "Does"]}
                rows={[
                  [
                    <C key="a">create_transaction</C>,
                    "Records an expense, income or transfer as pending, marked as made by the assistant.",
                  ],
                  [
                    <C key="b">create_recurring_rule</C>,
                    "Sets up a recurring movement or subscription, paused until you confirm it.",
                  ],
                ]}
              />
              <Callout>
                Write tools exist only when you allowed recording on the consent
                screen. Retrying a call never records it twice.
              </Callout>
            </>
          ),
        },
        {
          id: "count",
          title: "At a glance",
          body: (
            <p>
              {READ_TOOLS.length} read tools, 2 write tools. No tool deletes,
              edits history, moves money or changes settings.
            </p>
          ),
        },
      ],
    },
    {
      slug: "security",
      group: "Reference",
      title: "Security and privacy",
      description:
        "What Claude can and can't do with your Keepwell data, and how to take access back.",
      sections: [
        {
          id: "permissions",
          title: "Permissions",
          body: (
            <ul>
              <li>
                <strong>Read</strong> lets Claude see your data through the read
                tools.
              </li>
              <li>
                <strong>Record</strong> adds the write tools. You see both on
                the consent screen before allowing.
              </li>
              <li>
                Claude signs in with a token, never your password. The token is
                bound to Keepwell&rsquo;s connector and expires quickly.
              </li>
            </ul>
          ),
        },
        {
          id: "pending",
          title: "Pending until you confirm",
          body: (
            <p>
              Movements and recurring payments an assistant proposes stay{" "}
              <strong>pending</strong>, marked as its own. They don&rsquo;t
              count toward balances until you confirm them in Keepwell. There is
              also a limit on how many an assistant can propose per hour.
            </p>
          ),
        },
        {
          id: "data",
          title: "Your data",
          body: (
            <p>
              Claude reads only what a question needs. Anthropic handles what
              Claude reads under its own privacy policy. Keepwell&rsquo;s is at{" "}
              <Link href="/privacy">Privacy</Link>.
            </p>
          ),
        },
        {
          id: "disconnect",
          title: "Disconnecting",
          body: (
            <>
              <p>
                In Keepwell, <strong>Settings → Connected assistants</strong>:
                disconnect one assistant, or every one at once. Access ends
                immediately. You can also remove the connector in Claude&rsquo;s
                settings.
              </p>
            </>
          ),
        },
      ],
    },
    {
      slug: "troubleshooting",
      group: "Help",
      title: "Troubleshooting",
      description: "Fixes for the usual problems.",
      sections: [
        {
          id: "cant-connect",
          title: "Claude can't connect",
          body: (
            <ul>
              <li>
                Check the URL is exactly{" "}
                {mcpUrl ? <C>{mcpUrl}</C> : "the connector URL"}, with no spaces
                or trailing slash.
              </li>
              <li>
                Disconnect the connector in Claude, connect it again and sign in
                once more.
              </li>
              <li>
                On Team or Enterprise, ask an owner to add the connector for the
                organization.
              </li>
            </ul>
          ),
        },
        {
          id: "no-tools",
          title: "Claude doesn't use Keepwell",
          body: (
            <ul>
              <li>Turn Keepwell on in the chat&rsquo;s tools menu.</li>
              <li>
                Mention it: &ldquo;Using Keepwell, how am I doing this
                month?&rdquo;
              </li>
            </ul>
          ),
        },
        {
          id: "no-view",
          title: "The answer has no view",
          body: (
            <ul>
              <li>
                Views appear for summaries, trends, upcoming payments and
                pending movements, in apps that support them.
              </li>
              <li>
                If you connected before views existed, disconnect and connect
                again so Claude picks up the new tools.
              </li>
            </ul>
          ),
        },
        {
          id: "cant-record",
          title: "Claude can't record movements",
          body: (
            <p>
              Recording needs the write permission. Disconnect, connect again
              and allow recording on the consent screen.
            </p>
          ),
        },
        {
          id: "settings",
          title: "No “Connected assistants” in Settings",
          body: (
            <p>
              Sign in to your Keepwell account in the app or on the web; the
              section appears for signed-in accounts.
            </p>
          ),
        },
      ],
    },
  ]
}

function spanish(
  url: ReactNode,
  command: ReactNode,
  mcpUrl: string | undefined
): DocPage[] {
  const noServer = (
    <Callout kind="warning">
      Esta versión de Keepwell no tiene servidor, así que no tiene conector.
    </Callout>
  )
  return [
    {
      slug: "",
      group: "Primeros pasos",
      title: "Keepwell para Claude",
      description:
        "Pregúntale a Claude por tu dinero con tus palabras. El conector MCP de Keepwell le permite leer tus cuentas y movimientos, mostrarlos en vistas interactivas y proponer movimientos que tú confirmas.",
      sections: [
        {
          id: "what-it-does",
          title: "Qué hace",
          body: (
            <>
              <p>
                Keepwell tiene un <strong>conector MCP</strong> (Model Context
                Protocol, el estándar abierto con el que Claude habla con otras
                apps). Al conectarlo, Claude responde preguntas sobre tus
                finanzas con tus números reales, en cualquiera de tus monedas.
              </p>
              <ul>
                <li>
                  <strong>Leer:</strong> cuentas y saldos, patrimonio, un mes
                  por categoría, presupuestos, tendencias, pagos próximos y
                  fechas de tarjeta, y una búsqueda en tus movimientos.
                </li>
                <li>
                  <strong>Ver:</strong> en Claude, los resúmenes, tendencias y
                  pagos próximos se abren como vistas interactivas que puedes
                  ampliar y ajustar.
                </li>
                <li>
                  <strong>Anotar, con tu visto bueno:</strong> Claude puede
                  proponer un movimiento o un pago recurrente. Queda pendiente
                  hasta que lo confirmas en Keepwell.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "how-it-works",
          title: "Cómo funciona",
          body: (
            <Steps
              items={[
                {
                  title: "Agregas Keepwell a Claude como conector",
                  body: (
                    <p>
                      Una vez, en la web o la app de escritorio. Después aparece
                      también en tu teléfono.
                    </p>
                  ),
                },
                {
                  title: "Inicias sesión en Keepwell y das permiso",
                  body: (
                    <p>
                      Claude nunca ve tu contraseña: Keepwell le da un token que
                      puedes revocar cuando quieras.
                    </p>
                  ),
                },
                {
                  title:
                    "Claude usa las herramientas de Keepwell cuando tu pregunta lo necesita",
                  body: (
                    <p>
                      Lee solo lo que la pregunta necesita y muestra el
                      resultado como texto o como vista.
                    </p>
                  ),
                },
              ]}
            />
          ),
        },
        {
          id: "requirements",
          title: "Requisitos",
          body: (
            <ul>
              <li>
                Una cuenta de Keepwell. Durante el acceso anticipado el conector
                está incluido en todas las cuentas.
              </li>
              <li>
                Claude en la web, la app de escritorio o Claude Code, con un
                plan que permita conectores personalizados. En Team y Enterprise
                lo agrega quien administra la organización.
              </li>
            </ul>
          ),
        },
        {
          id: "next",
          title: "Siguiente",
          body: (
            <p>
              Sigue la <Link href="/docs/mcp">guía rápida</Link> para conectarte
              en unos dos minutos, o mira los{" "}
              <Link href="/docs/prompts">ejemplos de preguntas</Link>.
            </p>
          ),
        },
      ],
    },
    {
      slug: "mcp",
      group: "Primeros pasos",
      title: "Guía rápida",
      description: "Conecta Claude a Keepwell en unos dos minutos.",
      sections: [
        {
          id: "connector-url",
          title: "1. Copia la dirección del conector",
          body: (
            <>
              <p>
                Es la dirección a la que se conecta Claude. Pégala tal cual, sin
                barra al final.
              </p>
              {url ?? noServer}
            </>
          ),
        },
        {
          id: "add-connector",
          title: "2. Agrégalo a Claude",
          body: (
            <PlatformTabs
              tabs={[
                {
                  id: "web",
                  label: "Web y escritorio",
                  body: (
                    <Steps
                      items={[
                        {
                          title: (
                            <>
                              Abre <strong>Configuración → Conectores</strong>
                            </>
                          ),
                          body: (
                            <p>
                              Elige{" "}
                              <strong>Agregar conector personalizado</strong>.
                            </p>
                          ),
                        },
                        {
                          title: (
                            <>
                              Ponle de nombre <strong>Keepwell</strong> y pega
                              la dirección
                            </>
                          ),
                          body: (
                            <p>
                              Deja vacía la configuración avanzada y agrégalo.
                            </p>
                          ),
                        },
                        {
                          title: (
                            <>
                              Toca <strong>Conectar</strong>
                            </>
                          ),
                          body: (
                            <p>
                              Keepwell se abre en una ventana nueva. Inicia
                              sesión con Apple o con tu llave de acceso.
                            </p>
                          ),
                        },
                        {
                          title: (
                            <>
                              Revisa lo que pide y toca{" "}
                              <strong>Permitir</strong>
                            </>
                          ),
                          body: (
                            <p>
                              Claude pide leer tus datos y, si lo pide, proponer
                              movimientos.
                            </p>
                          ),
                        },
                      ]}
                    />
                  ),
                },
                {
                  id: "mobile",
                  label: "iPhone y Android",
                  body: (
                    <>
                      <p>
                        Los conectores se agregan en la web o la app de
                        escritorio. Una vez agregado, Keepwell aparece en la app
                        de Claude del teléfono, con la misma cuenta.
                      </p>
                      <Callout kind="tip">
                        En el teléfono, abre el menú de herramientas de un chat
                        para comprobar que Keepwell está activado.
                      </Callout>
                    </>
                  ),
                },
                {
                  id: "code",
                  label: "Claude Code",
                  body: (
                    <>
                      <p>En la terminal:</p>
                      {command}
                      <p>
                        Luego, dentro de Claude Code, escribe <C>/mcp</C>, elige{" "}
                        <strong>keepwell</strong> e inicia sesión en el
                        navegador. Más en{" "}
                        <Link href="/docs/claude-code">Claude Code</Link>.
                      </p>
                    </>
                  ),
                },
              ]}
            />
          ),
        },
        {
          id: "try-it",
          title: "3. Pruébalo",
          body: (
            <>
              <p>
                En un chat nuevo, activa Keepwell en el menú de herramientas y
                pregunta:
              </p>
              <Prompt>¿Cómo voy este mes?</Prompt>
              <p>
                Claude responde con tus números y muestra el mes en una vista
                interactiva.
              </p>
            </>
          ),
        },
      ],
    },
    {
      slug: "claude-code",
      group: "Primeros pasos",
      title: "Claude Code",
      description:
        "Usa Keepwell desde la terminal, con la misma cuenta y los mismos permisos.",
      sections: [
        {
          id: "add",
          title: "Agrega el servidor",
          body: (
            <>
              {command ?? noServer}
              <p>
                Así queda para tu usuario. Agrega <C>--scope project</C> para
                compartirlo con un proyecto mediante <C>.mcp.json</C>.
              </p>
            </>
          ),
        },
        {
          id: "sign-in",
          title: "Inicia sesión",
          body: (
            <Steps
              items={[
                {
                  title: (
                    <>
                      Escribe <C>/mcp</C> en Claude Code
                    </>
                  ),
                },
                {
                  title: (
                    <>
                      Elige <strong>keepwell</strong> y{" "}
                      <strong>Authenticate</strong>
                    </>
                  ),
                  body: (
                    <p>Tu navegador abre el inicio de sesión de Keepwell.</p>
                  ),
                },
                {
                  title: <>Da permiso</>,
                  body: (
                    <p>
                      De vuelta en la terminal, el servidor aparece conectado
                      con sus herramientas.
                    </p>
                  ),
                },
              ]}
            />
          ),
        },
        {
          id: "remove",
          title: "Quitarlo",
          body: <Copyable value="claude mcp remove keepwell" />,
        },
      ],
    },
    {
      slug: "prompts",
      group: "Uso",
      title: "Ejemplos de preguntas",
      description:
        "Preguntas que funcionan bien. Pregunta con tus palabras: Claude elige las herramientas.",
      sections: [
        {
          id: "overview",
          title: "Panorama",
          body: (
            <>
              <Prompt>Dame un panorama de mis finanzas.</Prompt>
              <Prompt>
                ¿Cuál es mi patrimonio y cuánto hay en cada cuenta?
              </Prompt>
            </>
          ),
        },
        {
          id: "spending",
          title: "Gastos y presupuestos",
          body: (
            <>
              <Prompt>¿Cómo voy este mes? ¿En qué gasté más?</Prompt>
              <Prompt>¿Qué presupuestos estoy a punto de pasar?</Prompt>
              <Prompt>Compara octubre y noviembre.</Prompt>
            </>
          ),
        },
        {
          id: "trends",
          title: "Tendencias",
          body: (
            <Prompt>
              Muéstrame cómo han cambiado mis ingresos y gastos en los últimos 6
              meses.
            </Prompt>
          ),
        },
        {
          id: "upcoming",
          title: "Lo que viene",
          body: (
            <>
              <Prompt>
                ¿Qué pagos y fechas de tarjeta tengo en los próximos 30 días?
              </Prompt>
              <Prompt>¿Qué suscripciones estoy pagando?</Prompt>
            </>
          ),
        },
        {
          id: "search",
          title: "Buscar movimientos",
          body: (
            <Prompt>Busca todo lo que gasté en restaurantes en octubre.</Prompt>
          ),
        },
        {
          id: "record",
          title: "Anotar",
          body: (
            <>
              <Prompt>
                Anota un gasto de 12.50 USD en el súper, con la tarjeta de
                débito.
              </Prompt>
              <Prompt>
                Agrega Netflix como suscripción mensual de 15.49 USD a partir
                del día 12.
              </Prompt>
              <Callout>
                Lo que anota Claude queda pendiente hasta que lo confirmas en
                Keepwell. Mira{" "}
                <Link href="/docs/security">Seguridad y privacidad</Link>.
              </Callout>
            </>
          ),
        },
      ],
    },
    {
      slug: "views",
      group: "Uso",
      title: "Vistas interactivas",
      description:
        "En Claude, algunas respuestas se abren como una vista que puedes ampliar y ajustar, hecha con tus datos.",
      sections: [
        {
          id: "views",
          title: "Las vistas",
          body: (
            <RefTable
              head={["Vista", "Aparece con", "Puedes"]}
              rows={[
                [
                  "Resumen del mes",
                  <>
                    <C>get_monthly_summary</C>, <C>get_financial_context</C>
                  </>,
                  "Ver ingresos, gastos y neto; ampliar para ver todas las categorías, presupuestos, cuentas y el mes anterior o siguiente",
                ],
                [
                  "Tendencias",
                  <C key="t">get_trends</C>,
                  "Cambiar entre 3, 6 y 12 meses",
                ],
                [
                  "Pagos próximos",
                  <C key="u">get_upcoming_payments</C>,
                  "Cambiar entre 7, 30 y 90 días",
                ],
                [
                  "Movimiento pendiente",
                  <>
                    <C>create_transaction</C>, <C>create_recurring_rule</C>
                  </>,
                  "Ver lo que preparó Claude antes de confirmarlo en Keepwell",
                ],
              ]}
            />
          ),
        },
        {
          id: "expand",
          title: "Ampliar una vista",
          body: (
            <p>
              Toca <strong>Ver todo</strong> para abrir la vista en pantalla
              completa, o en el panel lateral donde Claude lo ofrece. Toca{" "}
              <strong>Contraer</strong> para devolverla al chat.
            </p>
          ),
        },
        {
          id: "how",
          title: "Cómo funcionan",
          body: (
            <ul>
              <li>
                La vista es parte del conector de Keepwell y dibuja los mismos
                datos que recibe Claude. No carga nada de otros sitios.
              </li>
              <li>
                Cuando cambias un periodo, la vista vuelve a preguntarle a
                Keepwell a través de Claude, con los mismos permisos.
              </li>
              <li>
                La vista sigue el tema claro u oscuro de Claude y tu idioma.
              </li>
              <li>
                Donde una app no muestra vistas, Claude recibe los mismos datos
                como texto.
              </li>
            </ul>
          ),
        },
      ],
    },
    {
      slug: "tools",
      group: "Referencia",
      title: "Herramientas",
      description:
        "Todo lo que ofrece el conector. Los montos son decimales exactos con su moneda; nunca se suman monedas distintas.",
      sections: [
        {
          id: "read",
          title: "Herramientas de lectura",
          body: (
            <RefTable
              head={["Herramienta", "Devuelve", "Argumentos"]}
              rows={[
                [
                  <C key="1">get_financial_context</C>,
                  "Monedas, cuentas con saldos, patrimonio, este mes, presupuestos y los pagos de los próximos 14 días. Un buen punto de partida.",
                  "—",
                ],
                [
                  <C key="2">list_accounts</C>,
                  "Cuentas con su saldo en cada moneda, condiciones de crédito y tarjetas (solo los últimos cuatro dígitos).",
                  "—",
                ],
                [
                  <C key="3">get_net_worth</C>,
                  "Patrimonio en la moneda principal (y en la segunda, a tu tasa), por cuenta.",
                  "—",
                ],
                [
                  <C key="4">get_monthly_summary</C>,
                  "Ingresos, gastos y neto de un mes, por categoría, con presupuestos.",
                  <>
                    <C>month</C> AAAA-MM, este mes por defecto
                  </>,
                ],
                [
                  <C key="5">get_trends</C>,
                  "Ingresos, gastos y neto de cada uno de los últimos meses.",
                  <>
                    <C>months</C> 1–24, 6 por defecto
                  </>,
                ],
                [
                  <C key="6">get_upcoming_payments</C>,
                  "Movimientos recurrentes y fechas de pago de tarjeta desde hoy.",
                  <>
                    <C>days</C> 1–90, 30 por defecto
                  </>,
                ],
                [
                  <C key="7">search_transactions</C>,
                  "Movimientos, del más reciente al más antiguo, por páginas.",
                  <>
                    fechas, cuenta, categoría, tipo, moneda, estado, texto,{" "}
                    <C>limit</C> hasta 100
                  </>,
                ],
              ]}
            />
          ),
        },
        {
          id: "write",
          title: "Herramientas de escritura",
          body: (
            <>
              <RefTable
                head={["Herramienta", "Hace"]}
                rows={[
                  [
                    <C key="a">create_transaction</C>,
                    "Anota un gasto, ingreso o transferencia como pendiente, marcado como hecho por el asistente.",
                  ],
                  [
                    <C key="b">create_recurring_rule</C>,
                    "Crea un movimiento recurrente o suscripción, en pausa hasta que lo confirmes.",
                  ],
                ]}
              />
              <Callout>
                Las herramientas de escritura solo existen si permitiste anotar
                en la pantalla de permisos. Repetir una llamada nunca la anota
                dos veces.
              </Callout>
            </>
          ),
        },
        {
          id: "count",
          title: "En resumen",
          body: (
            <p>
              {READ_TOOLS.length} herramientas de lectura y 2 de escritura.
              Ninguna borra, edita el historial, mueve dinero ni cambia ajustes.
            </p>
          ),
        },
      ],
    },
    {
      slug: "security",
      group: "Referencia",
      title: "Seguridad y privacidad",
      description:
        "Qué puede y qué no puede hacer Claude con tus datos de Keepwell, y cómo quitarle el acceso.",
      sections: [
        {
          id: "permissions",
          title: "Permisos",
          body: (
            <ul>
              <li>
                <strong>Leer</strong> deja que Claude vea tus datos con las
                herramientas de lectura.
              </li>
              <li>
                <strong>Anotar</strong> agrega las herramientas de escritura.
                Ves los dos en la pantalla de permisos antes de aceptar.
              </li>
              <li>
                Claude entra con un token, nunca con tu contraseña. El token
                sirve solo para el conector de Keepwell y vence pronto.
              </li>
            </ul>
          ),
        },
        {
          id: "pending",
          title: "Pendiente hasta que confirmes",
          body: (
            <p>
              Los movimientos y pagos recurrentes que propone un asistente
              quedan <strong>pendientes</strong>, marcados como suyos. No
              cuentan en tus saldos hasta que los confirmas en Keepwell. Además,
              hay un límite de cuántos puede proponer por hora.
            </p>
          ),
        },
        {
          id: "data",
          title: "Tus datos",
          body: (
            <p>
              Claude lee solo lo que una pregunta necesita. Anthropic trata lo
              que Claude lee según su propia política de privacidad. La de
              Keepwell está en <Link href="/privacy?lang=es">Privacidad</Link>.
            </p>
          ),
        },
        {
          id: "disconnect",
          title: "Desconectar",
          body: (
            <p>
              En Keepwell, <strong>Ajustes → Asistentes conectados</strong>:
              desconecta un asistente, o todos a la vez. El acceso termina al
              instante. También puedes quitar el conector en la configuración de
              Claude.
            </p>
          ),
        },
      ],
    },
    {
      slug: "troubleshooting",
      group: "Ayuda",
      title: "Solución de problemas",
      description: "Soluciones para los problemas más comunes.",
      sections: [
        {
          id: "cant-connect",
          title: "Claude no se puede conectar",
          body: (
            <ul>
              <li>
                Revisa que la dirección sea exactamente{" "}
                {mcpUrl ? <C>{mcpUrl}</C> : "la del conector"}, sin espacios ni
                barra al final.
              </li>
              <li>
                Desconecta el conector en Claude, vuelve a conectarlo e inicia
                sesión de nuevo.
              </li>
              <li>
                En Team o Enterprise, pide a quien administra la organización
                que agregue el conector.
              </li>
            </ul>
          ),
        },
        {
          id: "no-tools",
          title: "Claude no usa Keepwell",
          body: (
            <ul>
              <li>Activa Keepwell en el menú de herramientas del chat.</li>
              <li>
                Menciónalo: &ldquo;Con Keepwell, ¿cómo voy este mes?&rdquo;
              </li>
            </ul>
          ),
        },
        {
          id: "no-view",
          title: "La respuesta no muestra una vista",
          body: (
            <ul>
              <li>
                Las vistas aparecen con resúmenes, tendencias, pagos próximos y
                movimientos pendientes, en las apps que las admiten.
              </li>
              <li>
                Si conectaste antes de que existieran las vistas, desconecta y
                vuelve a conectar para que Claude lea las herramientas nuevas.
              </li>
            </ul>
          ),
        },
        {
          id: "cant-record",
          title: "Claude no puede anotar movimientos",
          body: (
            <p>
              Anotar requiere el permiso de escritura. Desconecta, vuelve a
              conectar y permite anotar en la pantalla de permisos.
            </p>
          ),
        },
        {
          id: "settings",
          title: "No aparece “Asistentes conectados” en Ajustes",
          body: (
            <p>
              Inicia sesión en tu cuenta de Keepwell en la app o en la web; la
              sección aparece en las cuentas con sesión iniciada.
            </p>
          ),
        },
      ],
    },
  ]
}
