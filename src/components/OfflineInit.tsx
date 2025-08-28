"use client";

import { useEffect } from "react";
import { initOfflineSync } from "@/lib/offline/sync";

export default function OfflineInit() {
  useEffect(() => initOfflineSync(), []);
  return null;
}

