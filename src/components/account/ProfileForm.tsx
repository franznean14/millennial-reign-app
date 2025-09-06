"use client";

import { useState, useEffect } from "react";
import { format as formatDate } from "date-fns";
import { upsertProfile } from "@/lib/db/profiles";
import type { Profile, Gender, Privilege } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface ProfileFormProps {
  userId: string;
  initialEmail: string | null;
  initialProfile: Profile | null;
  bwiEnabled: boolean;
  isBwiParticipant: boolean;
  onBwiToggle: () => Promise<boolean>;
  onSaved: (profile: Profile) => void;
}

export function ProfileForm({ userId, initialEmail, initialProfile, bwiEnabled, isBwiParticipant, onBwiToggle, onSaved }: ProfileFormProps) {
  const [saving, setSaving] = useState(false);
  const [groupOptions, setGroupOptions] = useState<string[]>([]);
  const [showGroupInput, setShowGroupInput] = useState(false);
  // Helpers to handle YYYY-MM-DD safely in local time
  const parseLocalYMD = (s?: string | null) => {
    if (!s) return undefined as unknown as Date | undefined;
    const [y, m, d] = s.split("-").map((v) => Number(v));
    if (!y || !m || !d) return undefined as unknown as Date | undefined;
    return new Date(y, m - 1, d);
  };
  const formatLocalYMD = (d?: Date) => {
    if (!d) return null as unknown as string | null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const [formData, setFormData] = useState({
    first_name: initialProfile?.first_name || "",
    last_name: initialProfile?.last_name || "",
    middle_name: initialProfile?.middle_name || "",
    date_of_birth: parseLocalYMD(initialProfile?.date_of_birth),
    date_of_baptism: parseLocalYMD(initialProfile?.date_of_baptism),
    gender: initialProfile?.gender || null,
    privileges: initialProfile?.privileges || [],
    group_name: initialProfile?.group_name || "",
  });

  // Update form data when initialProfile changes (async loading)
  useEffect(() => {
    if (initialProfile) {
      console.log('Setting form data with profile:', initialProfile);
      setFormData({
        first_name: initialProfile.first_name || "",
        last_name: initialProfile.last_name || "",
        middle_name: initialProfile.middle_name || "",
        date_of_birth: parseLocalYMD(initialProfile.date_of_birth),
        date_of_baptism: parseLocalYMD(initialProfile.date_of_baptism),
        gender: initialProfile.gender || null,
        privileges: initialProfile.privileges || [],
        group_name: initialProfile.group_name || "",
      });
      console.log('Form data group_name set to:', initialProfile.group_name || "");
    }
  }, [initialProfile]);

  // Load existing group names from congregation and profiles table
  useEffect(() => {
    const loadGroupOptions = async () => {
      const supabase = createSupabaseBrowserClient();
      try {
        // Get groups from congregation groups RPC
        const [congregationGroupsResponse, profileGroupsResponse] = await Promise.all([
          supabase.rpc('get_congregation_groups'),
          // Get all unique group names from profiles table in the same congregation
          supabase
            .from('profiles')
            .select('group_name')
            .not('group_name', 'is', null)
            .neq('group_name', '')
            .eq('congregation_id', initialProfile!.congregation_id)
        ]);

        let options: string[] = [];

        // Add groups from congregation groups RPC
        if (congregationGroupsResponse.data) {
          const congGroups = congregationGroupsResponse.data
            .map((group: any) => group.group_name)
            .filter(Boolean);
          options.push(...congGroups);
        }

        // Add groups from profiles table
        if (profileGroupsResponse.data) {
          const profileGroups = profileGroupsResponse.data
            .map((profile: any) => profile.group_name)
            .filter(Boolean);
          options.push(...profileGroups);
        }

        // Add current user's group if it's not already in the list
        if (initialProfile?.group_name && !options.includes(initialProfile.group_name)) {
          options.push(initialProfile.group_name);
        }

        // Remove duplicates and sort alphabetically (ascending)
        options = [...new Set(options)].sort();
        console.log('Loaded group options:', options);
        console.log('Current user group:', initialProfile?.group_name);
        setGroupOptions(options);
      } catch (error) {
        console.error('Error loading group options:', error);
      }
    };
    
    // Only load if we have both the profile data and congregation_id
    if (initialProfile && initialProfile.congregation_id) {
      loadGroupOptions();
    }
  }, [initialProfile]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const profile = await upsertProfile({
        id: userId,
        first_name: formData.first_name,
        last_name: formData.last_name,
        middle_name: formData.middle_name || null,
        date_of_birth: formatLocalYMD(formData.date_of_birth),
        date_of_baptism: formatLocalYMD(formData.date_of_baptism),
        gender: formData.gender,
        privileges: formData.privileges,
        avatar_url: initialProfile?.avatar_url, // Preserve existing avatar
        time_zone: initialProfile?.time_zone || null,
        username: initialProfile?.username || null,
        role: initialProfile?.role || "user", // Preserve existing role
        group_name: formData.group_name || null,
        // Don't pass congregation_id - let upsertProfile preserve it automatically
      });

      toast.success("Profile updated successfully");
      onSaved(profile);
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const toggleBwiParticipation = async () => {
    try {
      const result = await onBwiToggle();
      toast.success(result ? "BWI participation enabled" : "BWI participation disabled");
    } catch (error: any) {
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
    <form onSubmit={handleSubmit} className="space-y-4 pb-10">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="first_name">First Name *</Label>
          <Input
            id="first_name"
            value={formData.first_name}
            onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Last Name *</Label>
          <Input
            id="last_name"
            value={formData.last_name}
            onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="middle_name">Middle Name</Label>
        <Input
          id="middle_name"
          value={formData.middle_name || ""}
          onChange={(e) => setFormData(prev => ({ ...prev, middle_name: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Date of Birth</Label>
          <DatePicker
            date={formData.date_of_birth}
            onSelect={(date) => setFormData(prev => ({ ...prev, date_of_birth: date }))}
            placeholder="Select birth date"
          />
        </div>
        <div className="space-y-2">
          <Label>Date of Baptism</Label>
          <DatePicker
            date={formData.date_of_baptism}
            onSelect={(date) => setFormData(prev => ({ ...prev, date_of_baptism: date }))}
            placeholder="Select baptism date"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="gender">Gender</Label>
        <Select
          value={formData.gender || ""}
          onValueChange={(value: Gender) => setFormData(prev => ({ ...prev, gender: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Group Name Dropdown - Now matches area dropdown behavior */}
      <div className="space-y-2">
        <Label htmlFor="group_name">Group Name</Label>
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
            value={formData.group_name ? formData.group_name : "__none__"} 
            onValueChange={(value) => {
              if (value === "__custom__") {
                setShowGroupInput(true);
                setFormData(prev => ({ ...prev, group_name: "" }));
              } else if (value === "__none__") {
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
              <SelectItem value="__none__">No group</SelectItem>
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

      {/* BWI Participation Section */}
      {bwiEnabled && (
        <div className="space-y-2">
          <Label>Business Witnessing Initiative (BWI)</Label>
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div className="space-y-1">
              <div className="text-sm font-medium">BWI Participant</div>
              <div className="text-xs text-muted-foreground">
                {isBwiParticipant 
                  ? "You can access the Business tab in navigation" 
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

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </form>
  );
}
