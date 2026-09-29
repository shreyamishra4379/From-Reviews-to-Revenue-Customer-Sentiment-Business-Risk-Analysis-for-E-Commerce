"use client";

import { Suspense } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { BusinessImpactContent } from "./BusinessImpactContent";

export default function BusinessImpactPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-[60vh] text-[#8B8FA3]">Loading business impact...</div>}>
        <BusinessImpactContent />
      </Suspense>
    </DashboardLayout>
  );
}