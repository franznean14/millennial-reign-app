"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { useSPA } from "@/components/SPAProvider";

export function LoginView() {
  return (
    <motion.div
      key="login"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen flex items-center justify-center bg-background pb-24" // Add bottom padding
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
  );
}
