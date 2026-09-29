"use client";

import { Suspense } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { OverviewContent } from "./overview/OverviewContent";

export default function OverviewPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-[60vh] text-[#8B8FA3]">Loading overview...</div>}>
        <OverviewContent />
      </Suspense>
    </DashboardLayout>
  );
}