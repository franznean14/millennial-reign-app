"use client";

import * as React from "react";

type SwitchProps = {
  id?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export function Switch({ id, checked, defaultChecked, onCheckedChange, disabled, className = "" }: SwitchProps) {
  const [local, setLocal] = React.useState<boolean>(defaultChecked ?? false);
  const isControlled = typeof checked === "boolean";
  const value = isControlled ? (checked as boolean) : local;
  const toggle = () => {
    if (disabled) return;
    const next = !value;
    if (!isControlled) setLocal(next);
    onCheckedChange?.(next);
  };
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={value}
      aria-disabled={disabled}
      onClick={toggle}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border px-0.5 transition-colors ${
        value ? "bg-primary/80 border-primary" : "bg-muted border-border"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${className}`}
    >
      <span
        className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm ring-0 transition-transform ${
          value ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

