"use client";

import React, { useMemo, useState } from "react";
import { BookOpen, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { type HouseholderWithDetails } from "@/lib/db/business";
import { formatStatusText } from "@/lib/utils/formatters";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerWideLeftContentTop,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { getStudyBibleDarkCardShade } from "@/lib/theme/study-bible-dark";

const CONTACTS_PREVIEW_MAX = 5;

/** Matches EstablishmentDetails / HomeTodoCard badge styling for householder status. */
function getHouseholderStatusColorClass(status: string) {
  switch (status) {
    case "potential":
      return "text-cyan-600 border-cyan-200 bg-cyan-50 dark:text-cyan-400 dark:border-cyan-800 dark:bg-cyan-950";
    case "do_not_call":
      return "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950";
    case "interested":
      return "text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:bg-blue-950";
    case "return_visit":
      return "text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:bg-orange-950";
    case "bible_study":
      return "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950";
    case "moved_branch":
    case "resigned":
      return "text-stone-600 border-stone-200 bg-stone-50 dark:text-stone-400 dark:border-stone-700 dark:bg-stone-950";
    default:
      return "text-gray-600 border-gray-200 bg-gray-50 dark:text-gray-400 dark:border-gray-800 dark:bg-gray-950";
  }
}

function dedupeHouseholders(rows: HouseholderWithDetails[]) {
  return rows.filter((h, i, self) => i === self.findIndex((x) => x.id === h.id));
}

interface ContactsSectionProps {
  householders: HouseholderWithDetails[];
  establishmentId: string;
  onHouseholderClick?: (householder: HouseholderWithDetails) => void;
  isLoading?: boolean;
  /** Tablet+: full contacts list opens in a left sheet (same pattern as {@link CallSection}). */
  preferLeftDetailPanel?: boolean;
  /**
   * When true, left sheets stack above the stacked contact pane (z-order), same as Calls.
   */
  insideStackedContactPane?: boolean;
}

export function ContactsSection({
  householders,
  establishmentId,
  onHouseholderClick,
  isLoading = false,
  preferLeftDetailPanel = false,
  insideStackedContactPane = false,
}: ContactsSectionProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMdUp = useMediaQuery("(min-width: 768px)");
  const useLeftPanel = Boolean(preferLeftDetailPanel && isMdUp);

  const uniqueHouseholders = useMemo(() => dedupeHouseholders(householders), [householders]);
  const previewHouseholders = useMemo(
    () => uniqueHouseholders.slice(0, CONTACTS_PREVIEW_MAX),
    [uniqueHouseholders]
  );

  const contactsListPaneShade = useMemo(
    () => getStudyBibleDarkCardShade(`bwi-contactssection-list:${establishmentId}`),
    [establishmentId]
  );

  const renderContactRow = (
    householder: HouseholderWithDetails,
    opts: { variant: "preview" | "drawer" }
  ) => {
    const initials = householder.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");

    const listChrome = opts.variant === "drawer";

    return (
      <button
        key={`${opts.variant}-${householder.id}`}
        type="button"
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
          listChrome
            ? "hover:bg-muted/50 dark:hover:bg-[#2a2534]/85"
            : "hover:bg-muted/50 transition-colors"
        )}
        onClick={() => {
          // Mobile bottom sheet: close the list so contact details read cleanly.
          // Tablet left sheet: keep the contacts sidebar open beside establishment + contact detail stack.
          if (opts.variant === "drawer" && !useLeftPanel) setDrawerOpen(false);
          onHouseholderClick?.(householder);
        }}
      >
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="text-[11px] font-semibold">{initials || "HH"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-medium">{householder.name}</p>
            <Badge
              variant="outline"
              className={cn(
                "h-5 px-2 py-0.5 text-xs leading-none",
                getHouseholderStatusColorClass(householder.status)
              )}
            >
              {formatStatusText(householder.status)}
            </Badge>
          </div>
          {householder.note ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{householder.note}</p>
          ) : null}
        </div>
      </button>
    );
  };

  const expandedListBody = (forDrawer: boolean) => (
    <div
      className={
        forDrawer
          ? "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2"
          : "flex-1 overflow-y-auto p-4 pb-20"
      }
    >
      {isLoading ? (
        <div className="space-y-2 px-0 py-0">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted/60 blur-[2px]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="h-4 w-28 animate-pulse rounded bg-muted/60 blur-[2px]" />
                  <div className="h-5 w-16 animate-pulse rounded bg-muted/60 blur-[2px]" />
                </div>
                <div className="h-3 w-40 animate-pulse rounded bg-muted/60 blur-[2px]" />
              </div>
            </div>
          ))}
        </div>
      ) : uniqueHouseholders.length === 0 ? (
        <div className="px-4 py-8 text-center text-muted-foreground">
          <BookOpen className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>No contacts yet</p>
          <p className="text-sm">Contacts will appear here when calls are added</p>
        </div>
      ) : (
        <div className="space-y-2">
          {uniqueHouseholders.map((h) => renderContactRow(h, { variant: "drawer" }))}
        </div>
      )}
    </div>
  );

  return (
    <div className="rounded-lg border bg-card p-4 shadow-md dark:border-[#1c1921] dark:bg-[#30283c] dark:text-[#fffaff]">
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="mb-4 flex w-full items-center gap-2 text-left text-base font-bold text-foreground transition-opacity hover:opacity-80"
      >
        <BookOpen className="h-5 w-5 shrink-0" />
        <span className="min-w-0 flex-1">
          Contacts{uniqueHouseholders.length ? ` (${uniqueHouseholders.length})` : ""}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 opacity-80" />
      </button>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted/60 blur-[2px]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted/60 blur-[2px]" />
                  <div className="h-5 w-14 animate-pulse rounded bg-muted/60 blur-[2px]" />
                </div>
                <div className="h-3 w-32 animate-pulse rounded bg-muted/60 blur-[2px]" />
              </div>
            </div>
          ))}
        </div>
      ) : previewHouseholders.length === 0 ? (
        <div className="text-center text-muted-foreground">
          <BookOpen className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>No contacts yet</p>
          <p className="text-sm">Contacts will appear here when calls are added</p>
        </div>
      ) : (
        <div className="space-y-2">
          {previewHouseholders.map((h) => renderContactRow(h, { variant: "preview" }))}
        </div>
      )}

      {useLeftPanel ? (
        <Drawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          direction="left"
          modal
          nested
          shouldScaleBackground={false}
        >
          {/*
            Always DrawerWideLeftContentTop (not Content vs Top branch): when contact details open,
            insideStackedContactPane becomes true and only stackAboveStackedRightSheet + z-index update —
            swapping components was remounting the sheet (close-then-reopen flicker).
          */}
          <DrawerWideLeftContentTop
            stackAboveStackedRightSheet={insideStackedContactPane}
            className={cn(
              "dark:border-[#1c1921] dark:text-[#fffaff] md:max-h-[100lvh]",
              contactsListPaneShade
            )}
          >
            <DrawerHeader className="bg-transparent px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center sm:text-center">
              <DrawerTitle className="text-center text-lg font-bold">Contacts</DrawerTitle>
            </DrawerHeader>
            {expandedListBody(true)}
          </DrawerWideLeftContentTop>
        </Drawer>
      ) : (
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent
            className={cn(
              "h-[85svh] max-h-[85svh] dark:border-[#1c1921] dark:text-[#fffaff] [&_.drawer-content-inner]:flex [&_.drawer-content-inner]:flex-col [&_.drawer-content-inner]:overflow-hidden",
              contactsListPaneShade
            )}
            handleClassName="dark:bg-[#80778e] dark:shadow-[0_0_18px_rgba(128,119,142,0.45)]"
          >
            <DrawerHeader className="shrink-0 bg-transparent px-4 pb-2 pt-4 items-center">
              <DrawerTitle className="text-center text-lg font-bold">Contacts</DrawerTitle>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{expandedListBody(true)}</div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
