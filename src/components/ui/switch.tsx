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
      className={`relative inline-flex h-6 w-10 items-center rounded-full border transition-colors ${
        value ? "bg-primary/80 border-primary" : "bg-muted border-border"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${value ? "translate-x-4" : "translate-x-1"}`}
      />
    </button>
  );
}

