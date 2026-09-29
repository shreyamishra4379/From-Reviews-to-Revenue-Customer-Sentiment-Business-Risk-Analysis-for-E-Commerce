"use client";

import { cn } from "@/lib/utils";

interface InsightBoxProps {
  children: React.ReactNode;
  variant?: "info" | "warning" | "success";
  className?: string;
}

export function InsightBox({ children, variant = "info", className }: InsightBoxProps) {
  const variants = {
    info: "border-l-[#00D4AA] bg-gradient-to-r from-[#00D4AA]/10 to-[#7B61FF]/10",
    warning: "border-l-[#FF6B6B] bg-gradient-to-r from-[#FF6B6B]/10 to-[#FFD93D]/10",
    success: "border-l-[#00D4AA] bg-[#00D4AA]/10",
  };

  return (
    <div
      className={cn(
        "border-l-4 rounded-r-xl p-4 my-4 text-sm text-[#C8CCD8]",
        variants[variant],
        className
      )}
    >
      {children}
    </div>
  );
}

interface SectionHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionHeader({ children, className }: SectionHeaderProps) {
  return (
    <h2 className={cn("text-xl font-bold text-white mb-4 pb-2 border-b border-[#00D4AA]/30", className)}>
      {children}
    </h2>
  );
}