"use client";

import { useState, useEffect, useMemo } from "react";
import { updateUserProfile } from "@/lib/db/profiles";
import type { Profile, Gender, Privilege } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserManagementFormProps {
  user: Profile;
  onSaved: (profile: Profile) => void;
  onClose: () => void;
}

// This form is only accessible to admin/superadmin users who are elders
// Security is enforced at the database level via RLS policies
export function UserManagementForm({ user, onSaved, onClose }: UserManagementFormProps) {
  const [saving, setSaving] = useState(false);
  const [bwiEnabled, setBwiEnabled] = useState(false);
  const [isBwiParticipant, setIsBwiParticipant] = useState(false);
  const [groupOptions, setGroupOptions] = useState<string[]>([]);
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [congregationOptions, setCongregationOptions] = useState<Array<{id: string, name: string}>>([]);
  const [formData, setFormData] = useState({
    privileges: user.privileges || [],
    group_name: user.group_name || "",
    congregation_id: user.congregation_id || null,
  });

  // Update form data when user prop changes
  useEffect(() => {
    setFormData({
      privileges: user.privileges || [],
      group_name: user.group_name || "",
      congregation_id: user.congregation_id || null,
    });
  }, [user]);

  const normalizePrivileges = (privileges: Privilege[]) =>
    Array.from(new Set(privileges)).sort();

  const hasFormChanges = useMemo(() => {
    const currentPrivileges = normalizePrivileges(formData.privileges);
    const initialPrivileges = normalizePrivileges(user.privileges || []);

    const privilegesChanged =
      currentPrivileges.length !== initialPrivileges.length ||
      currentPrivileges.some((p, i) => p !== initialPrivileges[i]);

    const currentGroup = formData.group_name || "";
    const initialGroup = user.group_name || "";

    const currentCongregationId = formData.congregation_id || null;
    const initialCongregationId = user.congregation_id || null;

    return (
      privilegesChanged ||
      currentGroup !== initialGroup ||
      currentCongregationId !== initialCongregationId
    );
  }, [formData, user]);

  // Load existing group names from congregation
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

  // Load congregation options
  useEffect(() => {
    const loadCongregations = async () => {
      const supabase = createSupabaseBrowserClient();
      try {
        const { data: congregations } = await supabase
          .from('congregations')
          .select('id, name')
          .order('name');
        if (congregations) {
          setCongregationOptions(congregations);
        }
      } catch (error) {
        console.error('Error loading congregations:', error);
      }
    };
    loadCongregations();
  }, []);

  // Check BWI status on component mount
  useEffect(() => {
    const checkBwiStatus = async () => {
      const supabase = createSupabaseBrowserClient();
      try {
        // Check if BWI is enabled for the congregation
        const { data: enabled } = await supabase.rpc('is_business_enabled');
        setBwiEnabled(!!enabled);
        
        // Check if this specific user is a BWI participant
        if (user?.congregation_id) {
          const { data: participant } = await supabase
            .from('business_participants')
            .select('active')
            .eq('congregation_id', user.congregation_id)
            .eq('user_id', user.id)
            .single();
          
          setIsBwiParticipant(!!participant?.active);
        }
      } catch (error) {
        console.error('Error checking BWI status:', error);
      }
    };
    checkBwiStatus();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Use the dedicated admin function for updating other users
      const profile = await updateUserProfile(user.id, {
        privileges: formData.privileges,
        group_name: formData.group_name || null,
        congregation_id: formData.congregation_id,
      });

      toast.success("User updated successfully");
      onSaved(profile);
    } catch (error: any) {
      console.error('User management error:', error);
      toast.error(error.message || "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const toggleBwiParticipation = async () => {
    const supabase = createSupabaseBrowserClient();
    try {
      // Use the new function that can toggle BWI for a specific user
      const { data, error } = await supabase.rpc('toggle_user_business_participation', {
        target_user_id: user.id
      });
      
      if (error) throw error;
      
      setIsBwiParticipant(!!data);
      toast.success(data ? "BWI participation enabled" : "BWI participation disabled");
    } catch (error: any) {
      console.error('BWI toggle error:', error);
      toast.error(error.message || "Failed to update BWI participation");
    }
  };

  const togglePrivilege = (privilege: Privilege) => {
    setFormData(prev => {
      let newPrivileges = [...prev.privileges];
      
      if (prev.privileges.includes(privilege)) {
        // Remove privilege if already selected
        newPrivileges = newPrivileges.filter(p => p !== privilege);
      } else {
        // Add privilege and handle conflicts
        newPrivileges = [...newPrivileges, privilege];
        
        // Elder and Ministerial Servant are mutually exclusive
        if (privilege === 'Elder') {
          newPrivileges = newPrivileges.filter(p => p !== 'Ministerial Servant');
        } else if (privilege === 'Ministerial Servant') {
          newPrivileges = newPrivileges.filter(p => p !== 'Elder');
        }
        
        // Regular Pioneer and Auxiliary Pioneer are mutually exclusive
        if (privilege === 'Regular Pioneer') {
          newPrivileges = newPrivileges.filter(p => p !== 'Auxiliary Pioneer');
        } else if (privilege === 'Auxiliary Pioneer') {
          newPrivileges = newPrivileges.filter(p => p !== 'Regular Pioneer');
        }
        
        // Group Overseer and Group Assistant are mutually exclusive
        if (privilege === 'Group Overseer') {
          newPrivileges = newPrivileges.filter(p => p !== 'Group Assistant');
        } else if (privilege === 'Group Assistant') {
          newPrivileges = newPrivileges.filter(p => p !== 'Group Overseer');
        }
      }
      
      return {
        ...prev,
        privileges: newPrivileges
      };
    });
  };

  const allPrivileges: Privilege[] = [
    "Elder",
    "Ministerial Servant", 
    "Regular Pioneer",
    "Auxiliary Pioneer",
    "Secretary",
    "Coordinator",
    "Group Overseer",
    "Group Assistant"
  ];

  return (
    <div className="space-y-6">
      {/* User Header */}
      <div className="flex items-center gap-4 p-4 border rounded-lg">
        <Avatar className="h-16 w-16">
          <AvatarImage src={user.avatar_url || undefined} />
          <AvatarFallback className="text-lg">
            {`${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-xl font-semibold">{user.first_name} {user.last_name}</h2>
          <p className="text-sm text-muted-foreground">
            {user.username ? `@${user.username}` : "No username set"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 pb-10">
        {/* Congregation Assignment */}
        <div className="space-y-2">
          <Label>Congregation Assignment</Label>
          <Select
            value={formData.congregation_id || "none"}
            onValueChange={(value) => setFormData(prev => ({ 
              ...prev, 
              congregation_id: value === "none" ? null : value 
            }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select congregation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No congregation</SelectItem>
              {congregationOptions.map((cong) => (
                <SelectItem key={cong.id} value={cong.id}>
                  {cong.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Group Name Assignment */}
        <div className="space-y-2">
          <Label>Group Assignment</Label>
          {showGroupInput ? (
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="Enter new group name"
                value={formData.group_name}
                onChange={(e) => setFormData(prev => ({ ...prev, group_name: e.target.value }))}
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
              value={formData.group_name || "none"} 
              onValueChange={(value) => {
                if (value === "__custom__") {
                  setShowGroupInput(true);
                  setFormData(prev => ({ ...prev, group_name: "" }));
                } else if (value === "none") {
                  setFormData(prev => ({ ...prev, group_name: "" }));
                } else {
                  setFormData(prev => ({ ...prev, group_name: value }));
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select group or add new" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No group</SelectItem>
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

        {/* Privileges */}
        <div className="space-y-2">
          <Label>Privileges</Label>
          <div className="grid grid-cols-2 gap-2">
            {allPrivileges.map((privilege) => (
              <Button
                key={privilege}
                type="button"
                variant={formData.privileges.includes(privilege) ? "default" : "outline"}
                onClick={() => togglePrivilege(privilege)}
                className="justify-start"
              >
                {formData.privileges.includes(privilege) ? "✓ " : ""}{privilege}
              </Button>
            ))}
          </div>
        </div>

        {/* BWI Participation */}
        {bwiEnabled && (
          <div className="space-y-2">
            <Label>Business Witnessing Initiative (BWI)</Label>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div className="space-y-1">
                <div className="text-sm font-medium">BWI Participant</div>
                <div className="text-xs text-muted-foreground">
                  {isBwiParticipant 
                    ? "User can access the Business tab in navigation" 
                    : "Enable to access Business Witnessing features"
                  }
                </div>
              </div>
              <Switch
                checked={isBwiParticipant}
                onCheckedChange={toggleBwiParticipation}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className={`flex gap-2 ${hasFormChanges ? "justify-between" : "justify-start"}`}>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {hasFormChanges && (
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
