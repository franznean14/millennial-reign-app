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
  onSaved: (profile: Profile) => void;
}

export function ProfileForm({ userId, initialEmail, initialProfile, onSaved }: ProfileFormProps) {
  const [saving, setSaving] = useState(false);
  const [bwiEnabled, setBwiEnabled] = useState(false);
  const [isBwiParticipant, setIsBwiParticipant] = useState(false);
  const [groupOptions, setGroupOptions] = useState<string[]>([]);
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [formData, setFormData] = useState({
    first_name: initialProfile?.first_name || "",
    last_name: initialProfile?.last_name || "",
    middle_name: initialProfile?.middle_name || "",
    date_of_birth: initialProfile?.date_of_birth ? new Date(initialProfile.date_of_birth) : undefined,
    date_of_baptism: initialProfile?.date_of_baptism ? new Date(initialProfile.date_of_baptism) : undefined,
    gender: initialProfile?.gender || null,
    privileges: initialProfile?.privileges || [],
    group_name: initialProfile?.group_name || "",
  });

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

  // Check BWI status on component mount
  useEffect(() => {
    const checkBwiStatus = async () => {
      const supabase = createSupabaseBrowserClient();
      try {
        const { data: enabled } = await supabase.rpc('is_business_enabled');
        const { data: participant } = await supabase.rpc('is_business_participant');
        setBwiEnabled(!!enabled);
        setIsBwiParticipant(!!participant);
      } catch (error) {
        console.error('Error checking BWI status:', error);
      }
    };
    checkBwiStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const profile = await upsertProfile({
        id: userId,
        first_name: formData.first_name,
        last_name: formData.last_name,
        middle_name: formData.middle_name || null,
        date_of_birth: formData.date_of_birth?.toISOString().split('T')[0] || null,
        date_of_baptism: formData.date_of_baptism?.toISOString().split('T')[0] || null,
        gender: formData.gender,
        privileges: formData.privileges,
        time_zone: initialProfile?.time_zone || null,
        username: initialProfile?.username || null,
        role: "user",
        group_name: formData.group_name || null,
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
    const supabase = createSupabaseBrowserClient();
    try {
      const { data, error } = await supabase.rpc('toggle_business_participation');
      if (error) throw error;
      
      setIsBwiParticipant(!!data);
      toast.success(data ? "BWI participation enabled" : "BWI participation disabled");
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
    <form onSubmit={handleSubmit} className="space-y-4">
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
            value={formData.group_name || ""} 
            onValueChange={(value) => {
              if (value === "__custom__") {
                setShowGroupInput(true);
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
