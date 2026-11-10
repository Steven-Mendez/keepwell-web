"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import type { ReactNode } from "react"

import { KWAppIconTile } from "@/components/kw/kw-icon"
import { useT } from "@/lib/i18n"

/** Where people write about their data. One place, so the page never shows two addresses. */
export const PRIVACY_CONTACT = "stevenampaiz@icloud.com"
const UPDATED = { en: "November 9, 2026", es: "9 de noviembre de 2026" }

type Section = { title: string; body: ReactNode }

/**
 * The privacy policy, written from what the code stores (keepwell-api schema, infra and the apps).
 * Change it together with them: a new table, provider or retention period belongs here too.
 */
const CONTENT: Record<"en" | "es", { title: string; lead: string; updated: string; sections: Section[] }> = {
  en: {
    title: "Privacy Policy",
    lead: "Keepwell is a personal finance app. Your data lives on your device. It reaches our servers only if you create a Keepwell account to sync it, and we never sell it, show you ads or track you.",
    updated: "Last updated",
    sections: [
      {
        title: "Without an account",
        body: (
          <p>
            Everything you enter (accounts, cards, movements, budgets, goals, debts) stays on your iPhone or in your
            browser. We receive nothing. A CSV file you export stays wherever you save it.
          </p>
        ),
      },
      {
        title: "With a Keepwell account",
        body: (
          <>
            <p>An account is optional and syncs your data between the iPhone app and the web. To provide it we store:</p>
            <ul>
              <li>
                <strong>Your identity from Sign in with Apple:</strong> a stable Apple identifier, and the name and email
                Apple shares (the email can be Apple&rsquo;s private relay address). We never see your Apple password.
              </li>
              <li>
                <strong>Your finance data:</strong> the same records you keep in the app, so other devices can sync them,
                with a history of changes used to resolve sync conflicts.
              </li>
              <li>
                <strong>Passkeys</strong> you add: only their public key. The private key never leaves your device.
              </li>
              <li>
                <strong>Security records:</strong> sign-ins, account creation, passkeys, connected assistants and deletion
                requests, with the IP address and browser or device type. They never include amounts, descriptions or notes.
              </li>
              <li>
                <strong>Purchases:</strong> if you buy &ldquo;Buy Me a Coffee&rdquo;, Apple processes the payment. We keep
                Apple&rsquo;s transaction identifier and the plan it grants, never your payment details.
              </li>
            </ul>
          </>
        ),
      },
      {
        title: "Connected assistants (Claude)",
        body: (
          <p>
            If you connect an AI assistant such as Claude, you choose what it may do (read, or also propose new
            movements) on a consent screen. It can then read your Keepwell data through that connection, and anything it
            creates is marked as such and waits for your confirmation. The assistant&rsquo;s provider handles what it
            reads under its own privacy policy. You can disconnect every assistant at once in Settings.
          </p>
        ),
      },
      {
        title: "Who processes data for us",
        body: (
          <ul>
            <li>
              <strong>Amazon Web Services</strong> (United States) hosts the database and the server.
            </li>
            <li>
              <strong>Vercel</strong> hosts the web app and forwards its requests to our server.
            </li>
            <li>
              <strong>Apple</strong> provides Sign in with Apple, passkeys through iCloud Keychain, payments and TestFlight.
            </li>
          </ul>
        ),
      },
      {
        title: "What we don't do",
        body: (
          <ul>
            <li>No ads, no advertising identifiers and no tracking across apps or websites.</li>
            <li>No analytics services in the app or on the web.</li>
            <li>We don&rsquo;t sell or share your data with anyone beyond the providers above.</li>
            <li>We don&rsquo;t connect to your bank: Keepwell only knows what you enter.</li>
          </ul>
        ),
      },
      {
        title: "How long we keep it, and deleting it",
        body: (
          <>
            <p>
              Delete your account any time in Settings &rarr; Account &rarr; Delete account, on the web or the iPhone.
              Every session ends at once and your synced finance data, passkeys and connections are erased from our
              database right after.
            </p>
            <ul>
              <li>Encrypted database backups keep a copy for up to 35 more days, then it is gone.</li>
              <li>Server logs are kept for 90 days.</li>
              <li>
                Security records and purchase records are kept after deletion, the purchase records without any link to
                you, to prevent fraud and meet accounting duties.
              </li>
              <li>What is on your iPhone or in your browser stays there until you erase it.</li>
            </ul>
          </>
        ),
      },
      {
        title: "Security",
        body: (
          <p>
            Data travels encrypted (HTTPS) and is stored encrypted. Each person can only reach their own data, which our
            tests check on every change. Sessions use secure cookies, and you can end them on every device from Settings.
          </p>
        ),
      },
      {
        title: "Your rights",
        body: (
          <p>
            You can see your data in the app, export it as a file, correct it, and delete your account. For anything
            else, including a copy of what our server holds about you, write to us. Keepwell is not meant for children
            under 13.
          </p>
        ),
      },
      {
        title: "Changes and contact",
        body: (
          <p>
            If this policy changes in a way that matters, the app will tell you before it applies. Questions:{" "}
            <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>. Keepwell is run by Steven Mendez, an independent
            developer in Managua, Nicaragua.
          </p>
        ),
      },
    ],
  },
  es: {
    title: "Política de privacidad",
    lead: "Keepwell es una app de finanzas personales. Tus datos viven en tu dispositivo. Solo llegan a nuestros servidores si creas una cuenta Keepwell para sincronizarlos, y nunca los vendemos, ni te mostramos anuncios, ni te rastreamos.",
    updated: "Última actualización",
    sections: [
      {
        title: "Sin cuenta",
        body: (
          <p>
            Todo lo que registras (cuentas, tarjetas, movimientos, presupuestos, metas, deudas) se queda en tu iPhone o en
            tu navegador. No recibimos nada. Un archivo CSV que exportes se queda donde lo guardes.
          </p>
        ),
      },
      {
        title: "Con una cuenta Keepwell",
        body: (
          <>
            <p>La cuenta es opcional y sincroniza tus datos entre la app del iPhone y la web. Para eso guardamos:</p>
            <ul>
              <li>
                <strong>Tu identidad de Iniciar sesión con Apple:</strong> un identificador estable de Apple, y el nombre y
                correo que Apple comparta (el correo puede ser la dirección privada de Apple). Nunca vemos tu contraseña de
                Apple.
              </li>
              <li>
                <strong>Tus datos financieros:</strong> los mismos registros que tienes en la app, para que otros
                dispositivos los sincronicen, con un historial de cambios que sirve para resolver conflictos.
              </li>
              <li>
                <strong>Passkeys</strong> que añadas: solo su clave pública. La clave privada nunca sale de tu dispositivo.
              </li>
              <li>
                <strong>Registros de seguridad:</strong> inicios de sesión, creación de la cuenta, passkeys, asistentes
                conectados y solicitudes de borrado, con la dirección IP y el tipo de navegador o dispositivo. Nunca
                incluyen montos, descripciones ni notas.
              </li>
              <li>
                <strong>Compras:</strong> si compras &ldquo;Invítame un café&rdquo;, Apple procesa el pago. Guardamos el
                identificador de la transacción de Apple y el plan que otorga, nunca tus datos de pago.
              </li>
            </ul>
          </>
        ),
      },
      {
        title: "Asistentes conectados (Claude)",
        body: (
          <p>
            Si conectas un asistente de IA como Claude, eliges en una pantalla de consentimiento qué puede hacer (leer, o
            también proponer movimientos). Entonces puede leer tus datos de Keepwell por esa conexión, y lo que cree queda
            marcado y espera tu confirmación. El proveedor del asistente trata lo que lee según su propia política de
            privacidad. Puedes desconectar todos los asistentes a la vez en Ajustes.
          </p>
        ),
      },
      {
        title: "Quién trata datos por nosotros",
        body: (
          <ul>
            <li>
              <strong>Amazon Web Services</strong> (Estados Unidos) aloja la base de datos y el servidor.
            </li>
            <li>
              <strong>Vercel</strong> aloja la web y reenvía sus peticiones a nuestro servidor.
            </li>
            <li>
              <strong>Apple</strong> provee Iniciar sesión con Apple, las passkeys del Llavero de iCloud, los pagos y
              TestFlight.
            </li>
          </ul>
        ),
      },
      {
        title: "Lo que no hacemos",
        body: (
          <ul>
            <li>Sin anuncios, sin identificadores publicitarios y sin rastreo entre apps o sitios.</li>
            <li>Sin servicios de analítica en la app ni en la web.</li>
            <li>No vendemos ni compartimos tus datos con nadie más allá de los proveedores de arriba.</li>
            <li>No nos conectamos a tu banco: Keepwell solo sabe lo que tú registras.</li>
          </ul>
        ),
      },
      {
        title: "Cuánto tiempo los guardamos y cómo borrarlos",
        body: (
          <>
            <p>
              Borra tu cuenta cuando quieras en Ajustes &rarr; Cuenta &rarr; Eliminar cuenta, en la web o en el iPhone.
              Todas las sesiones terminan al instante y tus datos financieros sincronizados, passkeys y conexiones se
              borran de nuestra base de datos enseguida.
            </p>
            <ul>
              <li>Los respaldos cifrados de la base de datos guardan una copia hasta 35 días más; después desaparece.</li>
              <li>Los registros del servidor se guardan 90 días.</li>
              <li>
                Los registros de seguridad y de compras se conservan después del borrado, los de compras sin ningún vínculo
                contigo, para prevenir fraude y cumplir obligaciones contables.
              </li>
              <li>Lo que esté en tu iPhone o en tu navegador se queda ahí hasta que lo borres.</li>
            </ul>
          </>
        ),
      },
      {
        title: "Seguridad",
        body: (
          <p>
            Los datos viajan cifrados (HTTPS) y se guardan cifrados. Cada persona solo puede llegar a sus propios datos, y
            nuestras pruebas lo comprueban en cada cambio. Las sesiones usan cookies seguras y puedes cerrarlas en todos los
            dispositivos desde Ajustes.
          </p>
        ),
      },
      {
        title: "Tus derechos",
        body: (
          <p>
            Puedes ver tus datos en la app, exportarlos a un archivo, corregirlos y borrar tu cuenta. Para cualquier otra
            cosa, incluida una copia de lo que nuestro servidor guarda sobre ti, escríbenos. Keepwell no está pensada para
            menores de 13 años.
          </p>
        ),
      },
      {
        title: "Cambios y contacto",
        body: (
          <p>
            Si esta política cambia de forma importante, la app te lo dirá antes de aplicarlo. Preguntas:{" "}
            <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>. Keepwell lo opera Steven Mendez, desarrollador
            independiente en Managua, Nicaragua.
          </p>
        ),
      },
    ],
  },
}

export function PrivacyPolicy() {
  const t = useT()
  // ?lang=es|en picks the language explicitly (App Store Connect keeps one URL per listing language);
  // otherwise it follows the app's language.
  const requested = useSearchParams().get("lang")
  const lang = requested === "es" || requested === "en" ? requested : t.locale.startsWith("es") ? "es" : "en"
  const page = CONTENT[lang]
  return (
    <main className="min-h-svh bg-background px-4 py-12">
      <article lang={lang} className="mx-auto flex max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Link href="/" aria-label="Keepwell">
              <KWAppIconTile size={44} />
            </Link>
            <nav aria-label="Language" className="type-caption flex gap-3">
              {(["en", "es"] as const).map((code) => (
                <Link
                  key={code}
                  href={`/privacy?lang=${code}`}
                  lang={code}
                  aria-current={code === lang ? "page" : undefined}
                  className={code === lang ? "font-semibold text-foreground" : "text-muted-foreground hover:underline"}
                >
                  {code === "en" ? "English" : "Español"}
                </Link>
              ))}
            </nav>
          </div>
          <h1 className="type-title">{page.title}</h1>
          <p className="type-body text-muted-foreground">{page.lead}</p>
          <p className="type-caption text-muted-foreground">
            {page.updated}: {UPDATED[lang]}
          </p>
        </header>
        {page.sections.map((section) => (
          <section
            key={section.title}
            className="flex flex-col gap-3 type-body [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2"
          >
            <h2 className="type-heading">{section.title}</h2>
            {section.body}
          </section>
        ))}
      </article>
    </main>
  )
}
