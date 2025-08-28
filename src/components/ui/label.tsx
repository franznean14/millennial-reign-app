"use client";

import * as React from "react";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className = "", ...props },
  ref
) {
  return <label ref={ref} className={`text-sm font-medium leading-none ${className}`} {...props} />;
});

