import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Space_Grotesk } from "next/font/google";
import { auth, signOut } from "@/auth";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import "./globals.css";

// Applied before paint so the saved/system theme doesn't flash.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme:dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "KubeSpaces",
    template: "%s — KubeSpaces",
  },
  description:
    "Open control plane for virtual Kubernetes tenants. Create a tenant, get a cluster.",
};

const APP_VERSION = process.env.APP_VERSION ?? "dev";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${inter.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="bg-paper text-ink">
        {session?.user ? (
          <AppShell
            email={session.user.email ?? session.user.name ?? "account"}
            version={APP_VERSION}
            onSignOut={handleSignOut}
          >
            {children}
          </AppShell>
        ) : (
          <div className="flex min-h-dvh flex-col">
            <header className="border-b border-rule">
              <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
                <Link
                  href="/"
                  className="font-display text-lg font-semibold tracking-tight text-ink transition-colors hover:text-accent"
                >
                  KubeSpaces
                  <span aria-hidden="true" className="ml-1.5 text-accent">
                    ⌁
                  </span>
                </Link>
                <ThemeToggle />
              </div>
            </header>
            <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
              {children}
            </main>
          </div>
        )}
      </body>
    </html>
  );
}
