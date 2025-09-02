"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddUserToCongregationForm } from "./AddUserToCongregationForm";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/sonner";

interface UserSearchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onUserAdded: (user: any) => void;
  currentCongregationId: string;
}

export function UserSearchDrawer({ isOpen, onClose, onUserAdded, currentCongregationId }: UserSearchDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  // Search for user as they type (with debouncing)
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResult(null);
      return;
    }
    
    setSearching(true);
    try {
      const supabase = createSupabaseBrowserClient();
      
      // Search by username (exact match)
      let { data: userByUsername, error: usernameError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, avatar_url, congregation_id, group_name')
        .eq('username', query.trim())
        .single();

      // If no username match, search by email (exact match)
      if (!userByUsername && !usernameError) {
        const { data: userByEmail, error: emailError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url, congregation_id, group_name')
          .eq('email', query.trim())
          .single();
        
        if (userByEmail) {
          userByUsername = userByEmail;
        }
      }

      if (userByUsername) {
        setSearchResult(userByUsername);
      } else {
        setSearchResult(null);
      }
    } catch (error) {
      console.error('Error searching for user:', error);
      setSearchResult(null);
    } finally {
      setSearching(false);
    }
  };

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    
    // Clear previous timeout
    if (window.searchTimeout) {
      clearTimeout(window.searchTimeout);
    }
    
    // Set new timeout for search
    window.searchTimeout = setTimeout(() => {
      handleSearch(value);
    }, 300); // 300ms delay
  };

  const handleClose = () => {
    setSearchQuery("");
    setSearchResult(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Add User to Congregation</h2>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <AddUserToCongregationForm
              congregationId={currentCongregationId}
              onUserAdded={onUserAdded}
              onClose={handleClose}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Add type declaration for the timeout
declare global {
  interface Window {
    searchTimeout?: NodeJS.Timeout;
  }
}
