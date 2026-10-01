"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/",                   icon: "🏠", label: "Overview" },
  { href: "/customer-voice",     icon: "🧠", label: "Customer Voice" },
  { href: "/category",           icon: "🏢", label: "Category Intelligence" },
  { href: "/delivery",           icon: "🚚", label: "Delivery" },
  { href: "/business-impact",    icon: "💰", label: "Business Impact" },
  { href: "/sql-analytics",      icon: "🗄️", label: "SQL Analytics" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h2>Reviews → Revenue</h2>
        <p>Olist E-Commerce Analytics</p>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(({ href, icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`nav-link${path === href ? " active" : ""}`}
          >
            <span className="nav-icon">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <strong>Dataset:</strong> Olist E-Commerce<br />
        <strong>Currency:</strong> BRL (R$)<br />
        <strong>Language:</strong> Portuguese<br />
        <strong>Stages:</strong> 1–4 outputs<br />
        <strong>NLP:</strong> XLM-RoBERTa
      </div>
    </aside>
  );
}
