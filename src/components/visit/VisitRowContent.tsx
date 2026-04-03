"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface VisitRowContentProps {
  title: ReactNode;
  titleBadge?: ReactNode;
  metaIcon?: ReactNode;
  /** When omitted, the meta row (e.g. date/participants line) is not rendered. */
  metaText?: string;
  metaClassName?: string;
  notes?: string | null;
  notesClassName?: string;
}

export function VisitRowContent({
  title,
  titleBadge,
  metaIcon,
  metaText,
  metaClassName,
  notes,
  notesClassName
}: VisitRowContentProps) {
  return (
    <>
      <div
        className={cn(
          "flex min-w-0 w-full items-center gap-2",
          metaText ? "mb-1" : "mb-3"
        )}
      >
        {typeof title === "string" ? (
          <span className="text-sm font-medium text-foreground">{title}</span>
        ) : (
          title
        )}
        {titleBadge}
      </div>
      {metaText ? (
        <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", metaClassName)}>
          {metaIcon}
          {metaText}
        </div>
      ) : null}
      {notes && (
        <div className={cn("text-base leading-snug text-muted-foreground", notesClassName)}>{notes}</div>
      )}
    </>
  );
}
