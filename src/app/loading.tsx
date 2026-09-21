import React from "react";
import { BrandPageLoader } from "@/components/ui/loader";

export default function Loading() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <BrandPageLoader
        message="Loading SmartBiz ERP..."
        submessage="Preparing real-time accounting ledgers, journals & FBR compliance data..."
      />
    </div>
  );
}
