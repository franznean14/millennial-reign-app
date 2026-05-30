"use client";

import * as React from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import {
  FORM_DRAWER_PHONE_ATTR,
  getFormDrawerPhoneClassName,
} from "@/lib/theme/form-drawer-phone";

type DrawerRootProps = React.ComponentProps<typeof Drawer>;
type DrawerContentProps = React.ComponentProps<typeof DrawerContent>;

/** Vaul `repositionInputs` off — use visual-viewport clamp + scroll (see ios-viewport-safe-area.mdc). */
export function FormDrawerRoot({ repositionInputs: _ignored, ...props }: DrawerRootProps) {
  return <Drawer repositionInputs={false} {...props} />;
}

type FormDrawerContentProps = DrawerContentProps & {
  /** Content-height sheet when keyboard closed (e.g. Field Service). */
  fitContent?: boolean;
};

export const FormDrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerContent>,
  FormDrawerContentProps
>(({ fitContent = false, className, ...props }, ref) => {
  return (
    <DrawerContent
      ref={ref}
      {...FORM_DRAWER_PHONE_ATTR}
      data-drawer-fit-content={fitContent ? "" : undefined}
      className={cn(getFormDrawerPhoneClassName({ fitContent }), className)}
      {...props}
    />
  );
});
FormDrawerContent.displayName = "FormDrawerContent";
