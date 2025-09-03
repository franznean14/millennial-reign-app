"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface AddUserToCongregationFormProps {
  congregationId: string;
  onUserAdded: (user: any) => void;
  onClose: () => void;
}

export function AddUserToCongregationForm({ congregationId, onUserAdded, onClose }: AddUserToCongregationFormProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [groupOptions, setGroupOptions] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [showGroupInput, setShowGroupInput] = useState(false);
  const hasFocused = useRef(false);

  // Load existing group names
  useEffect(() => {
    const loadGroupOptions = async () => {
      const supabase = createSupabaseBrowserClient();
      try {
        const { data: groups } = await supabase.rpc('get_congregation_groups');
        if (groups) {
          const options = groups.map((group: any) => group.group_name).filter(Boolean);
          setGroupOptions(options);
        }
      } catch (error) {
        console.error('Error loading group options:', error);
      }
    };
    loadGroupOptions();
  }, []);

  // Auto-focus search input when component mounts
  useEffect(() => {
    if (searchInputRef.current && !hasFocused.current) {
      searchInputRef.current.focus();
      hasFocused.current = true;
    }
  }, [congregationId]); // Add congregationId as dependency

  // Search for user as they type (with debouncing)
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResult(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      handleSearch();
    }, 300); // 300ms delay

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      const supabase = createSupabaseBrowserClient();
      
      console.log('Searching for:', searchQuery.trim());
      
      // First, check if the RPC function exists by trying to call it
      try {
        console.log('Attempting RPC call...');
        const { data: user, error } = await supabase.rpc('search_user_by_username_or_email', {
          search_term: searchQuery.trim()
        });

        console.log('RPC response:', { data: user, error });
        console.log('User data type:', typeof user);
        console.log('User data length:', user?.length);
        console.log('User data:', user);

        if (error) {
          console.error('RPC error details:', error);
          console.error('RPC error code:', error.code);
          console.error('RPC error message:', error.message);
          // If RPC fails, fall back to direct query (only for elders)
          throw new Error('RPC function not available');
        }

        // Handle different response formats
        if (user) {
          let userData;
          if (Array.isArray(user) && user.length > 0) {
            userData = user[0];
          } else if (user && typeof user === 'object' && user.user_id) {
            userData = user;
          } else {
            console.log('No user data found in response');
            setSearchResult(null);
            return;
          }

          console.log('Processed user data:', userData);
          setSearchResult({
            id: userData.user_id || userData.id,
            first_name: userData.first_name,
            last_name: userData.last_name,
            email: userData.email,
            username: userData.username,
            avatar_url: userData.avatar_url,
            congregation_id: userData.congregation_id,
            group_name: userData.group_name
          });
          return;
        }
      } catch (rpcError) {
        console.log('RPC failed, trying direct query...', rpcError);
        
        // Fallback: Direct query (only for elders)
        // First check if current user is an elder
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) {
          toast.error("Authentication required");
          setSearchResult(null);
          return;
        }

        // Check if current user has elder privileges
        const { data: profile } = await supabase
          .from('profiles')
          .select('privileges')
          .eq('id', currentUser.id)
          .single();

        if (!profile?.privileges?.includes('Elder')) {
          toast.error("You don't have permission to search for users. Elder privilege required.");
          setSearchResult(null);
          return;
        }

        // Direct search query - only search by username since email is in auth.users
        const { data: users, error: searchError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, username, avatar_url, congregation_id, group_name')
          .eq('username', searchQuery.trim())
          .limit(1);

        if (searchError) {
          console.error('Direct query error:', searchError);
          toast.error("Search failed. Please try again.");
          setSearchResult(null);
          return;
        }

        if (users && users.length > 0) {
          // For direct query, we don't have email, so we'll show a message
          const user = users[0];
          setSearchResult({
            ...user,
            email: 'Email not available in direct search' // Placeholder since we can't access auth.users
          });
          toast.info("User found by username. Email search requires RPC function.");
          return;
        }

        // If no username match, show message about email search
        toast.info("No user found with that username. Email search requires RPC function.");
      }

      // No results found
      setSearchResult(null);
      
    } catch (error) {
      console.error('Unexpected error during search:', error);
      toast.error("An unexpected error occurred during search");
      setSearchResult(null);
    } finally {
      setSearching(false);
    }
  };

  const handleAddUser = async () => {
    if (!searchResult || !selectedGroup) return;
    
    setAddingUser(true);
    try {
      const supabase = createSupabaseBrowserClient();
      
      // Use RPC function to transfer user to congregation
      const { data, error } = await supabase.rpc('transfer_user_to_congregation', {
        target_user: searchResult.id,
        new_congregation: congregationId
      });

      if (error) throw error;
      
      // Update the user's group
      const { error: groupError } = await supabase
        .from('profiles')
        .update({ group_name: selectedGroup })
        .eq('id', searchResult.id);

      if (groupError) {
        console.error('Error updating group:', groupError);
        // Still show success since user was transferred
      }
      
      toast.success(`${searchResult.first_name} ${searchResult.last_name} added to congregation successfully!`);
      onUserAdded(searchResult);
      onClose();
    } catch (error: any) {
      console.error('Error adding user to congregation:', error);
      toast.error(error.message || "Failed to add user to congregation");
    } finally {
      setAddingUser(false);
    }
  };

  const canAddUser = searchResult && 
    searchResult.id && 
    selectedGroup && 
    searchResult.congregation_id !== congregationId;

  return (
    <div className="space-y-6 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] max-h-[70vh] overflow-y-auto">
      <div className="space-y-4">
        <Label htmlFor="search">Search by Username or Email</Label>
        <Input
          ref={searchInputRef}
          id="search"
          placeholder="Enter username or email"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />
        {searching && (
          <div className="text-sm text-muted-foreground">Searching...</div>
        )}
      </div>

      {/* Search Results */}
      {searchResult && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 border rounded-lg">
            <Avatar className="h-12 w-12">
              <AvatarImage src={searchResult.avatar_url} />
              <AvatarFallback className="text-lg">
                {searchResult.first_name?.[0]}{searchResult.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="font-medium">
                {searchResult.first_name} {searchResult.last_name}
              </div>
              <div className="text-sm text-muted-foreground">
                @{searchResult.username || 'No username'}
              </div>
              <div className="text-sm text-muted-foreground">
                {searchResult.email}
              </div>
              {searchResult.congregation_id === congregationId ? (
                <p className="text-sm text-green-500">Already in this congregation</p>
              ) : searchResult.congregation_id ? (
                <p className="text-sm text-orange-500">Currently in another congregation</p>
              ) : (
                <p className="text-sm text-gray-500">Not assigned to a congregation</p>
              )}
            </div>
          </div>

          {/* Group Selection */}
          <div className="space-y-2">
            <Label>Assign to Group</Label>
            {showGroupInput ? (
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  placeholder="Enter new group name"
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  autoFocus
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowGroupInput(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Select 
                value={selectedGroup} 
                onValueChange={(value) => {
                  if (value === "__custom__") {
                    setShowGroupInput(true);
                    setSelectedGroup("");
                  } else {
                    setSelectedGroup(value);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select group or add new" />
                </SelectTrigger>
                <SelectContent>
                  {groupOptions.map((group) => (
                    <SelectItem key={group} value={group}>
                      {group}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">
                    + Add new group
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Add Button */}
          <Button
            onClick={handleAddUser}
            disabled={!canAddUser || addingUser}
            className="w-full"
          >
            {addingUser ? "Adding..." : `Add ${searchResult.first_name} to Congregation`}
          </Button>
        </div>
      )}

      {/* No Results Message */}
      {searchQuery.trim() && !searching && !searchResult && (
        <div className="text-center py-4 text-muted-foreground">
          No user found with that username or email
        </div>
      )}
    </div>
  );
}
