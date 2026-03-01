"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface VisitRowContentProps {
  title: ReactNode;
  titleBadge?: ReactNode;
  metaIcon?: ReactNode;
  metaText: string;
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
      <div className="flex items-center gap-2 mb-1">
        {typeof title === "string" ? (
          <span className="text-sm font-medium text-foreground">{title}</span>
        ) : (
          title
        )}
        {titleBadge}
      </div>
      <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", metaClassName)}>
        {metaIcon}
        {metaText}
      </div>
      {notes && (
        <div className={cn("text-xs text-muted-foreground", notesClassName)}>{notes}</div>
      )}
    </>
  );
}
