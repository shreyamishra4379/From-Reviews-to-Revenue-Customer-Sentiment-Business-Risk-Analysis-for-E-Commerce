import type { Metadata } from "next";
import "@fontsource/schibsted-grotesk/400.css";
import "@fontsource/schibsted-grotesk/500.css";
import "@fontsource/schibsted-grotesk/600.css";
import "@fontsource/schibsted-grotesk/700.css";
import "@fontsource/newsreader/400.css";
import "@fontsource/newsreader/500.css";
import "./globals.css";
import Sidebar from "./components/Sidebar";

export const metadata: Metadata = {
  title: "Reviews → Revenue",
  description: "What Olist customers complain about, how it relates to delivery and ratings, and how much order value is exposed. Money in R$.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="layout">
          <Sidebar />
          <main className="main"><div className="page">{children}</div></main>
        </div>
      </body>
    </html>
  );
}
