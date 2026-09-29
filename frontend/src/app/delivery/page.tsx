"use client";

import { Suspense } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DeliveryContent } from "./DeliveryContent";

export default function DeliveryPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-[60vh] text-[#8B8FA3]">Loading delivery analysis...</div>}>
        <DeliveryContent />
      </Suspense>
    </DashboardLayout>
  );
}