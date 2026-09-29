"use client";

import { Suspense } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CategoryIntelligenceContent } from "./CategoryIntelligenceContent";

export default function CategoryIntelligencePage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-[60vh] text-[#8B8FA3]">Loading category intelligence...</div>}>
        <CategoryIntelligenceContent />
      </Suspense>
    </DashboardLayout>
  );
}