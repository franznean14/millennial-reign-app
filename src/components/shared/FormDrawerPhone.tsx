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
  /** Stack above another open bottom sheet without closing it. */
  stackAboveParentSheet?: boolean;
  /** Stack above a sheet that already uses {@link stackAboveParentSheet}. */
  stackAboveStackedParentSheet?: boolean;
};

export const FormDrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerContent>,
  FormDrawerContentProps
>(({ fitContent = false, stackAboveParentSheet = false, stackAboveStackedParentSheet = false, className, ...props }, ref) => {
  return (
    <DrawerContent
      ref={ref}
      {...FORM_DRAWER_PHONE_ATTR}
      data-drawer-fit-content={fitContent ? "" : undefined}
      stackAboveParentSheet={stackAboveParentSheet}
      stackAboveStackedParentSheet={stackAboveStackedParentSheet}
      className={cn(getFormDrawerPhoneClassName({ fitContent }), className)}
      {...props}
    />
  );
});
FormDrawerContent.displayName = "FormDrawerContent";

/** Tablet root props for a nested picker beside an open form sheet. */
export const nestedFormPickerTabletRootProps = {
  direction: "right" as const,
  modal: true as const,
  nested: true as const,
  shouldScaleBackground: false as const,
};

type NestedFormPickerDrawerRootProps = DrawerRootProps & {
  /** When true, opens as a right-edge sheet on tablet (md+). */
  useTabletSidebar?: boolean;
};

/**
 * Bottom sheet (phone) or right sheet (tablet) for pickers opened inside an open form modal
 * (new/edit call, to-do, bulk assignee, etc.). Always stacks above the parent form drawer.
 */
export function NestedFormPickerDrawerRoot({
  useTabletSidebar = false,
  nested: nestedProp,
  ...props
}: NestedFormPickerDrawerRootProps) {
  // Phone: nested=false — parent FormModal is not a Vaul nested drawer; stacking is z-index only.
  // Tablet: nested=true for right-edge picker beside the open left form sheet.
  const nested = nestedProp ?? useTabletSidebar;
  return (
    <FormDrawerRoot
      nested={nested}
      {...(useTabletSidebar ? nestedFormPickerTabletRootProps : {})}
      {...props}
    />
  );
}

/** Phone bottom sheet content for nested form pickers — z-index above any open form tier. */
export const NestedFormPickerDrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerContent>,
  Omit<FormDrawerContentProps, "stackAboveParentSheet" | "stackAboveStackedParentSheet">
>((props, ref) => (
  <FormDrawerContent ref={ref} stackAboveStackedParentSheet {...props} />
));
NestedFormPickerDrawerContent.displayName = "NestedFormPickerDrawerContent";

/** Pass to {@link FormModal} for pickers opened inside an open form drawer (phone). */
export const nestedFormPickerFormModalStackProps = {
  stackAboveStackedParentSheet: true,
} as const;
