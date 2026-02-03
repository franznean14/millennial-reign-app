"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { cn } from "@/lib/utils";
import {
  getHeaderToastState,
  subscribeHeaderToast,
  type HeaderToastVariant,
} from "@/lib/header-toast-store";

const TOAST_VARIANT_STYLES: Record<HeaderToastVariant, string> = {
  success:
    "bg-green-600 text-white border-green-700 dark:bg-green-950/80 dark:border-green-600 dark:text-white",
  error:
    "bg-destructive text-destructive-foreground border-destructive/80 dark:bg-red-950/80 dark:border-red-500 dark:text-red-50",
  info:
    "bg-blue-600 text-white border-blue-700 dark:bg-blue-950/80 dark:border-blue-500 dark:text-white",
  warning:
    "bg-amber-600 text-white border-amber-700 dark:bg-amber-950/80 dark:border-amber-500 dark:text-white",
  default:
    "bg-primary text-primary-foreground border-primary/80 dark:bg-primary/20 dark:border-primary dark:text-primary-foreground",
};

function useHeaderToastState() {
  const [state, setState] = useState(getHeaderToastState);
  useEffect(() => {
    return subscribeHeaderToast(() => setState(getHeaderToastState()));
  }, []);
  return state;
}

export function LoginView() {
  const headerToast = useHeaderToastState();

  return (
    <>
      <AnimatePresence mode="wait">
        {headerToast.message ? (
          <motion.div
            key="login-toast"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 600, damping: 35 }}
            className={cn(
              "fixed left-4 right-4 top-[calc(var(--device-safe-top,0px)+12px)] z-[500] mx-auto w-[min(560px,92vw)] rounded-lg border px-4 py-3 text-center shadow-lg",
              TOAST_VARIANT_STYLES[headerToast.variant]
            )}
          >
            <span className="text-sm font-medium">{headerToast.message}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <motion.div
        key="login"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="min-h-screen flex items-center justify-center bg-background pb-20" // Add bottom padding
      >
        <div className="w-full max-w-sm px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center mb-8"
          >
            <h1 className="text-2xl font-semibold mb-2">Welcome</h1>
            <p className="text-sm text-muted-foreground">Sign in to your account</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <LoginForm />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 text-center"
          >
            <p className="text-xs text-muted-foreground">
              By logging in, you agree to our{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
            </p>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}
