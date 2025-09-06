"use client";

import dynamic from "next/dynamic";
import { useSPA } from "@/components/SPAProvider";

const AppClient = dynamic(() => import("@/components/AppClient").then(m => m.AppClient), { ssr: false });

export default function CatchAll() {
  const { currentSection } = useSPA();
  return (
    <AppClient currentSection={currentSection} />
  );
}


