"use client";

import dynamic from "next/dynamic";
import { useSPA } from "@/components/SPAProvider";
import { AppChrome } from "@/components/AppChrome";

const AppClient = dynamic(() => import("@/components/AppClient").then(m => m.AppClient), { ssr: false });

export default function Home() {
  const { currentSection } = useSPA();

  return (
    <AppChrome>
      <AppClient currentSection={currentSection} />
    </AppChrome>
  );
}
