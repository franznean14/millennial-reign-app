"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { FloatingAddFS } from "./FloatingAddFS";
import { BusinessFloatingButton } from "@/components/business/BusinessFloatingButton";

export function FloatingBridge() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Get selected area from URL for business page
  const selectedArea = pathname === "/business" ? searchParams.get('area') || undefined : undefined;
  
  // Get selected establishment ID from URL
  const selectedEstablishmentId = pathname === "/business" ? searchParams.get('establishment') || undefined : undefined;
  
  // Show business floating button on business page
  if (pathname === "/business") {
    return <BusinessFloatingButton 
      selectedArea={selectedArea} 
      selectedEstablishmentId={selectedEstablishmentId}
    />;
  }
  
  // Show field service floating button on other pages
  return <FloatingAddFS />;
}

