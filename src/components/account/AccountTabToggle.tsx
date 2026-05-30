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
import { studyBibleSectionToggle } from "@/lib/theme/study-bible-dark";

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
      
      refreshAuth();
      onSectionChange('login');
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error("Failed to sign out");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn(studyBibleSectionToggle.shellRow, "h-full min-h-0", className)}>
      <div className="flex h-full shrink-0 items-center justify-center pl-2">
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
        className={cn(
          studyBibleSectionToggle.group,
          "min-h-0 min-w-0 flex-1 !w-auto !min-w-0 rounded-none"
        )}
      >
        <ToggleGroupItem
          value="profile"
          className={cn(studyBibleSectionToggle.item, studyBibleSectionToggle.itemIcon)}
        >
          <User className="h-4 w-4 shrink-0" />
          <span className="text-[10px] font-medium leading-none text-center">Profile</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="account"
          className={cn(studyBibleSectionToggle.item, studyBibleSectionToggle.itemIcon)}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className="text-[10px] font-medium leading-none text-center">Account</span>
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="flex h-full shrink-0 items-center justify-center pl-1.5 pr-2">
        <Button
          variant="ghost"
          onClick={handleLogout}
          disabled={loading}
          className={cn(
            studyBibleSectionToggle.ghostSideButton,
            "flex w-auto shrink-0 flex-col items-center justify-center gap-0.5 !px-1 text-muted-foreground dark:text-[#ded6e7]"
          )}
          aria-label={loading ? "Signing out" : "Sign out"}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4 shrink-0" />
          )}
          <span className="text-[10px] font-medium leading-none text-center">Sign out</span>
        </Button>
      </div>
    </div>
  );
}
