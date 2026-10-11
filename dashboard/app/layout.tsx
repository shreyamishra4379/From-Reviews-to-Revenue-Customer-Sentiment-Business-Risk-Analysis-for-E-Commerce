import type { Metadata } from "next";
import "@fontsource/schibsted-grotesk/400.css";
import "@fontsource/schibsted-grotesk/500.css";
import "@fontsource/schibsted-grotesk/600.css";
import "@fontsource/schibsted-grotesk/700.css";
import "@fontsource/newsreader/400.css";
import "@fontsource/newsreader/500.css";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import { themeInitScript } from "./components/ThemeSwitch";

export const metadata: Metadata = {
  title: "Reviews → Revenue",
  description: "What Olist customers complain about, how it relates to delivery and ratings, and how much order value is exposed. Money in R$.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the theme script sets data-theme before React hydrates
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <div className="layout">
          <Sidebar />
          <main className="main" id="main" tabIndex={-1}><div className="page">{children}</div></main>
        </div>
      </body>
    </html>
  );
}
