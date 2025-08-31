"use client";

import { motion } from "motion/react";
import { LoginForm } from "@/components/auth/LoginForm";
import { useSPA } from "@/components/SPAProvider";

export function LoginView() {
  const { isLoading } = useSPA();

  return (
    <motion.div
      key="login"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen flex items-center justify-center bg-background"
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
          <LoginForm isLoading={isLoading} />
        </motion.div>
      </div>
    </motion.div>
  );
}
