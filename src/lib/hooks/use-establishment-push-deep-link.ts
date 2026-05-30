"use client";

import { useCallback, useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { EstablishmentWithDetails } from "@/lib/db/business";
import {
  PUSH_NAVIGATE_MESSAGE,
  clearEstablishmentIdFromLocation,
  readEstablishmentIdFromLocation,
  stashPendingEstablishmentPush,
  takePendingEstablishmentPush,
} from "@/lib/push/deep-link";
import { toast } from "@/components/ui/sonner";

type UseEstablishmentPushDeepLinkOptions = {
  sessionReady: boolean;
  userId: string | null;
  currentSection: string;
  pushNavigation: (section: string) => void;
  onSectionChange: (section: string) => void;
  setBusinessTab: (tab: "establishments" | "contacts" | "map") => void;
  setSelectedEstablishment: (est: EstablishmentWithDetails | null) => void;
  clearSelectedContact: () => void;
  loadEstablishmentDetails: (establishmentId: string) => void;
};

export function useEstablishmentPushDeepLink({
  sessionReady,
  userId,
  currentSection,
  pushNavigation,
  onSectionChange,
  setBusinessTab,
  setSelectedEstablishment,
  clearSelectedContact,
  loadEstablishmentDetails,
}: UseEstablishmentPushDeepLinkOptions) {
  const openingRef = useRef(false);

  const openEstablishmentDetails = useCallback(
    async (establishmentId: string) => {
      if (!userId || openingRef.current) return;

      openingRef.current = true;

      try {
        clearEstablishmentIdFromLocation();

        clearSelectedContact();
        setBusinessTab("establishments");

        const supabase = createSupabaseBrowserClient();
        const { data: establishment, error } = await supabase
          .from("business_establishments")
          .select(
            "id, name, area, statuses, lat, lng, floor, description, note, publisher_id, congregation_id"
          )
          .eq("id", establishmentId)
          .maybeSingle();

        if (error) {
          console.error("Push deep link: establishment load error", error);
          toast.error("Could not open establishment");
          return;
        }

        if (!establishment) {
          toast.info("Establishment not found. It may have been deleted.");
          return;
        }

        setSelectedEstablishment(establishment as EstablishmentWithDetails);
        loadEstablishmentDetails(establishment.id);
        pushNavigation(currentSection);
        window.setTimeout(() => {
          onSectionChange("business");
        }, 50);
      } catch (err) {
        console.error("Push deep link failed:", err);
      } finally {
        openingRef.current = false;
      }
    },
    [
      userId,
      currentSection,
      pushNavigation,
      onSectionChange,
      setBusinessTab,
      setSelectedEstablishment,
      clearSelectedContact,
      loadEstablishmentDetails,
    ]
  );

  const queueOrOpen = useCallback(
    (establishmentId: string) => {
      if (!establishmentId) return;
      if (!sessionReady || !userId) {
        stashPendingEstablishmentPush(establishmentId);
        return;
      }
      void openEstablishmentDetails(establishmentId);
    },
    [sessionReady, userId, openEstablishmentDetails]
  );

  useEffect(() => {
    if (!sessionReady || !userId) return;

    const pending = takePendingEstablishmentPush();
    if (pending) {
      void openEstablishmentDetails(pending);
      return;
    }

    const fromUrl = readEstablishmentIdFromLocation();
    if (fromUrl) {
      void openEstablishmentDetails(fromUrl);
    }
  }, [sessionReady, userId, openEstablishmentDetails]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== PUSH_NAVIGATE_MESSAGE) return;
      const establishmentId =
        typeof data.establishmentId === "string" ? data.establishmentId.trim() : "";
      if (establishmentId) {
        queueOrOpen(establishmentId);
      }
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [queueOrOpen]);
}
