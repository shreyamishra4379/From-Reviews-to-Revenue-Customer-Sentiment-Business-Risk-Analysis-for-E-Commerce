"use client";

import { Suspense } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SqlAnalyticsContent } from "./SqlAnalyticsContent";

export default function SqlAnalyticsPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-[60vh] text-[#8B8FA3]">Loading SQL analytics...</div>}>
        <SqlAnalyticsContent />
      </Suspense>
    </DashboardLayout>
  );
}