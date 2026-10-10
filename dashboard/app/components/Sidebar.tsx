"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, MessageSquareText, Truck, Boxes, Wallet,
  Sigma, Database, Sparkles, Menu, X,
} from "lucide-react";
import { STAR } from "@/lib/chart";

const GROUPS = [
  {
    title: "Findings",
    links: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/nlp-insights", label: "Customer voice", icon: MessageSquareText },
      { href: "/delivery", label: "Delivery", icon: Truck },
      { href: "/category-deep-dive", label: "Categories", icon: Boxes },
      { href: "/business-impact", label: "Business impact", icon: Wallet },
    ],
  },
  {
    title: "Evidence",
    links: [
      { href: "/statistical-analysis", label: "Statistics", icon: Sigma },
      { href: "/sql-analytics", label: "SQL workbench", icon: Database },
    ],
  },
  {
    title: "Ask",
    links: [{ href: "/ask-ai", label: "Ask AI", icon: Sparkles }],
  },
];

function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Reviews to Revenue, overview">
      <div className="brand-name">Reviews → Revenue</div>
      <div className="brand-sub">Olist marketplace, 2016–2018</div>
      <div className="brand-stars" aria-hidden>
        {STAR.map(c => <span key={c} style={{ background: c }} />)}
      </div>
    </Link>
  );
}

export default function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  return (
    <>
      <div className="topbar">
        <Brand />
        <button className="menu-btn" onClick={() => setOpen(o => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Brand />
        <nav className="nav" aria-label="Pages">
          {GROUPS.map(g => (
            <div className="nav-group" key={g.title}>
              <div className="nav-group-title">{g.title}</div>
              {g.links.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className={`nav-link${path === href ? " active" : ""}`}
                  aria-current={path === href ? "page" : undefined}>
                  <Icon size={17} strokeWidth={1.8} />
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          Money in Brazilian reais (R$).<br />
          Statistics show associations, not causes.
        </div>
      </aside>
    </>
  );
}
