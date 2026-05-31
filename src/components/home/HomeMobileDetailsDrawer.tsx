"use client";

import type { ReactNode } from "react";
import { DetailsDrawer, type DetailsDrawerProps } from "@/components/shared/DetailsDrawer";

interface HomeMobileDetailsDrawerProps extends Omit<DetailsDrawerProps, "entityName" | "layout"> {
  title: ReactNode;
}

/** @deprecated Prefer {@link DetailsDrawer} with `entityName` + `titleStatus`. */
export function HomeMobileDetailsDrawer({
  title,
  ...props
}: HomeMobileDetailsDrawerProps) {
  const entityName = typeof title === "string" ? title : String(title ?? "");
  return <DetailsDrawer entityName={entityName} layout="phone" {...props} />;
}
