"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { User, Settings, LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/sonner";
import { useSPA } from "@/components/SPAProvider";

interface AccountTabToggleProps {
  value: 'profile' | 'account';
  onValueChange: (value: 'profile' | 'account') => void;
  className?: string;
}

export function AccountTabToggle({
  value,
  onValueChange,
  className
}: AccountTabToggleProps) {
  const [loading, setLoading] = useState(false);
  const { onSectionChange, refreshAuth } = useSPA();

  const handleLogout = async () => {
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
      
      // Refresh authentication state to hide navigation
      refreshAuth();
      
      // Navigate to login
      onSectionChange('login');
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error("Failed to sign out");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("bg-background/95 backdrop-blur-sm border p-0.1 rounded-lg shadow-lg w-full relative overflow-hidden flex items-center gap-2", className)}>
      <div className="pl-2 flex-shrink-0 w-[39px] flex items-center justify-center">
        <ThemeToggle />
      </div>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(newValue) => {
          if (newValue) {
            onValueChange(newValue as 'profile' | 'account');
          }
        }}
        className="flex-[3] h-full"
      >
        <ToggleGroupItem 
          value="profile" 
          className="data-[state=on]:!bg-primary data-[state=on]:!text-primary-foreground data-[state=on]:shadow-sm flex-1 px-3 py-6 min-w-0 flex flex-col items-center justify-center gap-1 transition-colors"
        >
          <User className="h-4 w-4 flex-shrink-0" />
          <span className="text-[10px] font-medium text-center">Profile</span>
        </ToggleGroupItem>
        <ToggleGroupItem 
          value="account" 
          className="data-[state=on]:!bg-primary data-[state=on]:!text-primary-foreground data-[state=on]:shadow-sm flex-1 px-3 py-6 min-w-0 flex flex-col items-center justify-center gap-1 transition-colors"
        >
          <Settings className="h-4 w-4 flex-shrink-0" />
          <span className="text-[10px] font-medium text-center">Account</span>
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="pr-2 flex-shrink-0 w-[39px] flex items-center justify-center">
        <Button
          variant="ghost"
          onClick={handleLogout}
          disabled={loading}
          className="flex flex-col items-center justify-center gap-1 px-1.5 py-6 h-full w-full transition-colors"
          aria-label={loading ? "Signing out" : "Sign out"}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="text-[10px] font-medium text-center">Sign out</span>
        </Button>
      </div>
    </div>
  );
}
