"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import type { ReactNode } from "react"

import { KWAppIconTile } from "@/components/kw/kw-icon"
import { API_URL } from "@/lib/api/client"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
} from "@/components/ui/code-block"
import { useT } from "@/lib/i18n"

/**
 * The connector URL people paste into Claude. It is the API's /mcp, whether the API has its own host
 * or this deployment forwards it (src/lib/api/proxied-paths.ts lists /mcp either way).
 */
function connectorUrl(): string | undefined {
  if (API_URL) return `${API_URL}/mcp`
  return undefined
}

function Url({ value }: { value: string }) {
  return (
    <CodeBlock>
      <CodeBlockContent wrap>{value}</CodeBlockContent>
      <CodeBlockActions>
        <CodeBlockCopyButton value={value} />
      </CodeBlockActions>
    </CodeBlock>
  )
}

type Section = { title: string; body: ReactNode }
type Lang = "en" | "es"

/**
 * How to connect an assistant to Keepwell through MCP. Keep it in step with the API's tools
 * (keepwell-api/src/entrypoints/mcp) and the consent screen (/connect): a new tool or scope belongs here too.
 */
function content(
  lang: Lang,
  url: string | undefined
): { title: string; lead: string; sections: Section[] } {
  const urlBlock = url ? <Url value={url} /> : null
  const command = url
    ? `claude mcp add --transport http keepwell ${url}`
    : undefined
  if (lang === "es") {
    return {
      title: "Conecta Claude a Keepwell",
      lead: "Keepwell tiene un conector MCP: Claude (y otros asistentes compatibles) puede leer tus cuentas, movimientos, presupuestos y pagos próximos, y proponer movimientos nuevos que tú confirmas en Keepwell.",
      sections: [
        {
          title: "Antes de empezar",
          body: (
            <ul>
              <li>
                Una cuenta de Keepwell (inicia sesión en la web o en el iPhone).
                Durante el acceso anticipado el conector está incluido para
                todos.
              </li>
              <li>
                Claude en la web, la app de escritorio o Claude Code, con un
                plan que permita conectores personalizados. En Team y
                Enterprise, quien administra la organización es quien lo agrega.
              </li>
            </ul>
          ),
        },
        {
          title: "La dirección del conector",
          body: (
            <>
              <p>Copia esta dirección tal cual; la vas a pegar en Claude:</p>
              {urlBlock ?? (
                <p>
                  Esta versión de Keepwell no tiene servidor, así que no tiene
                  conector.
                </p>
              )}
            </>
          ),
        },
        {
          title: "En Claude (web o escritorio)",
          body: (
            <ol>
              <li>
                Abre <strong>Configuración → Conectores</strong> y elige{" "}
                <strong>Agregar conector personalizado</strong>.
              </li>
              <li>
                Ponle de nombre <strong>Keepwell</strong> y pega la dirección
                del conector. Agrégalo.
              </li>
              <li>
                Toca <strong>Conectar</strong>. Se abre Keepwell: inicia sesión
                con Apple o con tu llave de acceso.
              </li>
              <li>
                Revisa lo que pide Claude (leer tus datos y, si lo pide,
                proponer movimientos) y toca <strong>Permitir</strong>.
              </li>
              <li>
                En un chat, activa Keepwell desde el menú de herramientas y
                pregúntale algo.
              </li>
            </ol>
          ),
        },
        {
          title: "En el iPhone o Android",
          body: (
            <p>
              Agrega el conector primero desde la web o la app de escritorio.
              Después aparece solo en la app de Claude del teléfono, con la
              misma cuenta.
            </p>
          ),
        },
        {
          title: "En Claude Code",
          body: (
            <>
              <p>En la terminal:</p>
              {command ? <Url value={command} /> : null}
              <p>
                Luego, dentro de Claude Code, escribe <code>/mcp</code>, elige{" "}
                <strong>keepwell</strong> e inicia sesión en el navegador.
              </p>
            </>
          ),
        },
        {
          title: "Qué le puedes pedir",
          body: (
            <ul>
              <li>
                &ldquo;¿Cómo voy este mes? ¿En qué categorías gasté más?&rdquo;
              </li>
              <li>
                &ldquo;Muéstrame cómo han cambiado mis ingresos y gastos en los
                últimos 6 meses.&rdquo;
              </li>
              <li>
                &ldquo;¿Qué pagos y fechas de tarjeta tengo en los próximos 30
                días?&rdquo;
              </li>
              <li>
                &ldquo;Anota un gasto de 12.50 USD en el súper, con la tarjeta
                de débito.&rdquo;
              </li>
            </ul>
          ),
        },
        {
          title: "Lo que anota Claude espera tu confirmación",
          body: (
            <p>
              Los movimientos y pagos recurrentes que propone un asistente
              quedan <strong>pendientes</strong>, marcados como suyos. No
              cuentan en tus saldos hasta que los confirmas en Keepwell. Claude
              no puede borrar ni editar lo que ya existe.
            </p>
          ),
        },
        {
          title: "Desconectar",
          body: (
            <p>
              En Keepwell, <strong>Ajustes → Asistentes conectados</strong>:
              desconecta uno, o todos a la vez. También puedes quitar el
              conector en la configuración de Claude.
            </p>
          ),
        },
        {
          title: "Si algo no funciona",
          body: (
            <ul>
              <li>
                Revisa que la dirección sea exactamente la de arriba, sin
                espacios ni una barra al final.
              </li>
              <li>
                Si Claude no puede iniciar sesión, desconecta el conector,
                vuelve a conectarlo e inicia sesión de nuevo.
              </li>
              <li>
                Si no ves <strong>Asistentes conectados</strong> en Ajustes,
                inicia sesión en tu cuenta de Keepwell.
              </li>
            </ul>
          ),
        },
      ],
    }
  }
  return {
    title: "Connect Claude to Keepwell",
    lead: "Keepwell has an MCP connector: Claude (and other compatible assistants) can read your accounts, movements, budgets and upcoming payments, and propose new movements that you confirm in Keepwell.",
    sections: [
      {
        title: "Before you start",
        body: (
          <ul>
            <li>
              A Keepwell account (sign in on the web or the iPhone). During
              early access the connector is included for everyone.
            </li>
            <li>
              Claude on the web, the desktop app or Claude Code, on a plan that
              allows custom connectors. On Team and Enterprise, an organization
              admin adds it.
            </li>
          </ul>
        ),
      },
      {
        title: "The connector URL",
        body: (
          <>
            <p>Copy this URL exactly; you&rsquo;ll paste it into Claude:</p>
            {urlBlock ?? (
              <p>
                This build of Keepwell has no server, so it has no connector.
              </p>
            )}
          </>
        ),
      },
      {
        title: "In Claude (web or desktop)",
        body: (
          <ol>
            <li>
              Open <strong>Settings → Connectors</strong> and choose{" "}
              <strong>Add custom connector</strong>.
            </li>
            <li>
              Name it <strong>Keepwell</strong> and paste the connector URL. Add
              it.
            </li>
            <li>
              Click <strong>Connect</strong>. Keepwell opens: sign in with Apple
              or your passkey.
            </li>
            <li>
              Review what Claude asks for (reading your data and, if it asks,
              proposing movements) and click <strong>Allow</strong>.
            </li>
            <li>
              In a chat, turn on Keepwell from the tools menu and ask it
              something.
            </li>
          </ol>
        ),
      },
      {
        title: "On iPhone or Android",
        body: (
          <p>
            Add the connector on the web or the desktop app first. It then shows
            up in the Claude phone app on its own, with the same account.
          </p>
        ),
      },
      {
        title: "In Claude Code",
        body: (
          <>
            <p>In the terminal:</p>
            {command ? <Url value={command} /> : null}
            <p>
              Then, inside Claude Code, type <code>/mcp</code>, choose{" "}
              <strong>keepwell</strong> and sign in in the browser.
            </p>
          </>
        ),
      },
      {
        title: "What to ask",
        body: (
          <ul>
            <li>
              &ldquo;How am I doing this month? Where did I spend the
              most?&rdquo;
            </li>
            <li>
              &ldquo;Show me how my income and spending changed over the last 6
              months.&rdquo;
            </li>
            <li>
              &ldquo;Which payments and card due dates do I have in the next 30
              days?&rdquo;
            </li>
            <li>
              &ldquo;Log a 12.50 USD grocery expense on my debit card.&rdquo;
            </li>
          </ul>
        ),
      },
      {
        title: "What Claude records waits for you",
        body: (
          <p>
            Movements and recurring payments an assistant proposes stay{" "}
            <strong>pending</strong>, marked as its own. They don&rsquo;t count
            toward your balances until you confirm them in Keepwell. Claude
            can&rsquo;t delete or edit what&rsquo;s already there.
          </p>
        ),
      },
      {
        title: "Disconnecting",
        body: (
          <p>
            In Keepwell, <strong>Settings → Connected assistants</strong>:
            disconnect one, or all at once. You can also remove the connector in
            Claude&rsquo;s settings.
          </p>
        ),
      },
      {
        title: "If something doesn't work",
        body: (
          <ul>
            <li>
              Check the URL is exactly the one above, with no spaces or trailing
              slash.
            </li>
            <li>
              If Claude can&rsquo;t sign in, disconnect the connector, connect
              it again and sign in once more.
            </li>
            <li>
              If you don&rsquo;t see <strong>Connected assistants</strong> in
              Settings, sign in to your Keepwell account.
            </li>
          </ul>
        ),
      },
    ],
  }
}

export function McpGuide() {
  const t = useT()
  // ?lang=es|en picks the language explicitly, as on /privacy; otherwise it follows the app's language.
  const requested = useSearchParams().get("lang")
  const lang: Lang =
    requested === "es" || requested === "en"
      ? requested
      : t.locale.startsWith("es")
        ? "es"
        : "en"
  const page = content(lang, connectorUrl())
  return (
    <main className="min-h-svh bg-background px-4 py-12">
      <article lang={lang} className="mx-auto flex max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Link href="/" aria-label="Keepwell">
              <KWAppIconTile size={44} />
            </Link>
            <nav aria-label="Language" className="flex gap-3 type-caption">
              {(["en", "es"] as const).map((code) => (
                <Link
                  key={code}
                  href={`/docs/mcp?lang=${code}`}
                  lang={code}
                  aria-current={code === lang ? "page" : undefined}
                  className={
                    code === lang
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground hover:underline"
                  }
                >
                  {code === "en" ? "English" : "Español"}
                </Link>
              ))}
            </nav>
          </div>
          <h1 className="type-title">{page.title}</h1>
          <p className="type-body text-muted-foreground">{page.lead}</p>
        </header>
        {page.sections.map((section) => (
          <section
            key={section.title}
            className="flex flex-col gap-3 type-body [&_a]:underline [&_code]:font-mono [&_li]:ml-5 [&_ol]:flex [&_ol]:flex-col [&_ol]:gap-2 [&_ol>li]:list-decimal [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2 [&_ul>li]:list-disc"
          >
            <h2 className="type-heading">{section.title}</h2>
            {section.body}
          </section>
        ))}
      </article>
    </main>
  )
}
