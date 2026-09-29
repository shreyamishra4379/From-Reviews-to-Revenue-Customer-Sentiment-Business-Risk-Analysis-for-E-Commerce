"use client";

import { Suspense } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CustomerVoiceContent } from "./CustomerVoiceContent";

export default function CustomerVoicePage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-[60vh] text-[#8B8FA3]">Loading customer voice...</div>}>
        <CustomerVoiceContent />
      </Suspense>
    </DashboardLayout>
  );
}