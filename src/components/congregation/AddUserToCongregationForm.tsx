"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [groupOptions, setGroupOptions] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [guestNameOptions, setGuestNameOptions] = useState<string[]>([]);
  const [loadingGuestNames, setLoadingGuestNames] = useState(false);
  /** Exact label from visit history; empty = do not inherit */
  const [selectedGuestName, setSelectedGuestName] = useState<string>("");
  /** Guest publishers skip group assignment; sets is_congregation_guest on profile */
  const [addAsGuest, setAddAsGuest] = useState(false);

  const eligibleForGuestInherit =
    !!searchResult && searchResult.congregation_id !== congregationId;

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

  // Guest names still available to link (one publisher per guest label per congregation)
  useEffect(() => {
    if (!eligibleForGuestInherit) {
      setGuestNameOptions([]);
      setSelectedGuestName("");
      return;
    }

    let cancelled = false;
    const loadGuestNames = async () => {
      setLoadingGuestNames(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.rpc("list_inheritable_guest_names", {
          congregation_id_param: congregationId,
        });
        if (cancelled) return;
        if (error) {
          // PostgrestError serializes to "{}" in some consoles — log fields explicitly
          const detail = [error.message, error.details, error.hint].filter(Boolean).join(" — ");
          console.error("list_inheritable_guest_names failed", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          });
          toast.error("Could not load guest names", {
            description:
              detail ||
              "Check that the latest migration is applied and you have Elder privileges for this congregation.",
          });
          setGuestNameOptions([]);
          return;
        }
        const rows = Array.isArray(data) ? data : [];
        const names = rows
          .map((row: { guest_name?: string }) => row.guest_name)
          .filter((n: string | undefined): n is string => typeof n === "string" && n.trim().length > 0);
        setGuestNameOptions(names);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("list_inheritable_guest_names exception", e);
          toast.error("Could not load guest names", { description: msg });
          setGuestNameOptions([]);
        }
      } finally {
        if (!cancelled) setLoadingGuestNames(false);
      }
    };

    void loadGuestNames();
    return () => {
      cancelled = true;
    };
  }, [eligibleForGuestInherit, congregationId]);

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

  useEffect(() => {
    setAddAsGuest(false);
    setSelectedGroup("");
    setShowGroupInput(false);
    setSelectedGuestName("");
  }, [searchResult?.id]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      const supabase = createSupabaseBrowserClient();
      
      
      // First, check if the RPC function exists by trying to call it
      try {
        const { data: user, error } = await supabase.rpc('search_user_by_username_or_email', {
          search_term: searchQuery.trim()
        });


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
            setSearchResult(null);
            return;
          }

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
    if (!searchResult) return;
    if (!addAsGuest && !selectedGroup) return;

    setAddingUser(true);
    try {
      const supabase = createSupabaseBrowserClient();
      
      // Use RPC function to transfer user to congregation
      const { error } = await supabase.rpc('transfer_user_to_congregation', {
        target_user: searchResult.id,
        new_congregation: congregationId
      });

      if (error) throw error;
      
      const { error: profileError } = await supabase
        .from('profiles')
        .update(
          addAsGuest
            ? { group_name: null, is_congregation_guest: true }
            : { group_name: selectedGroup, is_congregation_guest: false },
        )
        .eq('id', searchResult.id);

      if (profileError) {
        console.error('Error updating profile after transfer:', profileError);
      }

      if (selectedGuestName.trim()) {
        const { error: inheritError } = await supabase.rpc("inherit_guest_name_on_profile", {
          congregation_id_param: congregationId,
          target_profile: searchResult.id,
          guest_name: selectedGuestName.trim(),
        });
        if (inheritError) {
          toast.error(
            inheritError.message ||
              "User was added but linking visit history failed. You can retry linking from support tools if available.",
          );
          onUserAdded(searchResult);
          onClose();
          return;
        }
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

  const canAddUser =
    !!searchResult &&
    !!searchResult.id &&
    searchResult.congregation_id !== congregationId &&
    (addAsGuest || !!selectedGroup);

  return (
    <div className="space-y-6 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]">
      <div className="space-y-4">
        <Label htmlFor="search">Search by Username or Email</Label>
        <Input
          id="search"
          placeholder="Enter username or email"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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

          {eligibleForGuestInherit && (
            <div className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div className="space-y-0.5 pr-2">
                <Label htmlFor="add-as-guest" className="text-sm font-medium">
                  Add as guest publisher
                </Label>
                <p className="text-xs text-muted-foreground">
                  No field service group is assigned. They appear under the Guest tab and get a Guest badge until you change it in Manage user.
                </p>
              </div>
              <Switch
                id="add-as-guest"
                checked={addAsGuest}
                onCheckedChange={(on) => {
                  setAddAsGuest(on);
                  if (on) {
                    setSelectedGroup("");
                    setShowGroupInput(false);
                  }
                }}
              />
            </div>
          )}

          {/* Optional: inherit visit rows from a guest name (same label can only link to one user; released if profile deleted) */}
          {eligibleForGuestInherit && (
            <div className="space-y-2">
              <Label>Inherit visit history from guest name (optional)</Label>
              <p className="text-xs text-muted-foreground">
                Each guest name can link to only one publisher in this congregation. Matching calls and to-dos are updated to this user.
              </p>
              {loadingGuestNames ? (
                <div className="text-sm text-muted-foreground">Loading guest names…</div>
              ) : guestNameOptions.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No unlinked guest names in visit history for this congregation.
                </div>
              ) : (
                <Select
                  value={selectedGuestName ? selectedGuestName : "__none__"}
                  onValueChange={(value) => setSelectedGuestName(value === "__none__" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None — do not link visit history" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[min(280px,50vh)]">
                    <SelectItem value="__none__">None</SelectItem>
                    {guestNameOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        <span className="truncate">{name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {eligibleForGuestInherit && !addAsGuest && (
            <div className="space-y-2">
              <Label>Assign to Group</Label>
              {showGroupInput ? (
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Enter new group name"
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
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
                    <SelectItem value="__custom__">+ Add new group</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <Button
            onClick={handleAddUser}
            disabled={!canAddUser || addingUser}
            className="w-full"
          >
            {addingUser
              ? "Adding..."
              : addAsGuest
                ? `Add ${searchResult.first_name} as guest`
                : `Add ${searchResult.first_name} to Congregation`}
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
