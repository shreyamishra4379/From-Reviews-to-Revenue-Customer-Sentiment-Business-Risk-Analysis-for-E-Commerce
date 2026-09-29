"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Brain,
  BarChart3,
  Truck,
  DollarSign,
  FolderKanban,
  Database,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/customer-voice", label: "Customer Voice", icon: Brain },
  { href: "/category-intelligence", label: "Category Intelligence", icon: BarChart3 },
  { href: "/delivery", label: "Delivery Analysis", icon: Truck },
  { href: "/business-impact", label: "Business Impact", icon: DollarSign },
  { href: "/sql-analytics", label: "SQL Analytics", icon: Database },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#0E1117] border-r border-white/5 flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-white/5">
        <h1 className="text-xl font-bold bg-gradient-to-r from-[#00D4AA] to-[#7B61FF] bg-clip-text text-transparent">
          Analytics
        </h1>
        <p className="text-xs text-[#5A5F73] mt-1">Sentiment-to-Outcome</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-gradient-to-r from-[#00D4AA]/20 to-[#7B61FF]/20 text-[#00D4AA] border border-[#00D4AA]/30"
                  : "text-[#8B8FA3] hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/5">
        <div className="text-center text-xs text-[#5A5F73]">
          <p>Olist E-Commerce Dataset</p>
          <p className="mt-1">Currency: BRL (R$)</p>
          <p className="mt-1">Language: Portuguese</p>
        </div>
      </div>
    </aside>
  );
}