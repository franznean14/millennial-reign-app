"use client";

import { useState } from "react";
import { format as formatDate } from "date-fns";
import { upsertProfile } from "@/lib/db/profiles";
import type { Profile, Gender, Privilege } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "@/components/ui/sonner";

interface ProfileFormProps {
  userId: string;
  initialEmail: string | null;
  initialProfile: Profile | null;
  onSaved: (profile: Profile) => void;
}

export function ProfileForm({ userId, initialEmail, initialProfile, onSaved }: ProfileFormProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    first_name: initialProfile?.first_name || "",
    last_name: initialProfile?.last_name || "",
    middle_name: initialProfile?.middle_name || "",
    date_of_birth: initialProfile?.date_of_birth ? new Date(initialProfile.date_of_birth) : undefined,
    date_of_baptism: initialProfile?.date_of_baptism ? new Date(initialProfile.date_of_baptism) : undefined,
    gender: initialProfile?.gender || null,
    privileges: initialProfile?.privileges || [],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const profile = await upsertProfile({
        id: userId,
        first_name: formData.first_name,
        last_name: formData.last_name,
        middle_name: formData.middle_name || null,
        // Use local calendar date to avoid timezone shifts
        date_of_birth: formData.date_of_birth ? formatDate(formData.date_of_birth, 'yyyy-MM-dd') : null,
        date_of_baptism: formData.date_of_baptism ? formatDate(formData.date_of_baptism, 'yyyy-MM-dd') : null,
        gender: formData.gender,
        privileges: formData.privileges,
        time_zone: initialProfile?.time_zone || null,
        username: initialProfile?.username || null,
        role: "user",
      });

      toast.success("Profile updated successfully");
      onSaved(profile);
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const togglePrivilege = (privilege: Privilege) => {
    setFormData(prev => {
      const has = prev.privileges.includes(privilege);
      // If already selected, just remove it
      if (has) {
        return { ...prev, privileges: prev.privileges.filter(p => p !== privilege) };
      }
      // Add with mutual-exclusion rules
      let next = [...prev.privileges, privilege];
      // MS vs Elder (only one allowed)
      if (privilege === 'Elder') {
        next = next.filter(p => p !== 'Ministerial Servant');
      }
      if (privilege === 'Ministerial Servant') {
        next = next.filter(p => p !== 'Elder');
      }
      // Regular vs Auxiliary Pioneer (only one allowed)
      if (privilege === 'Regular Pioneer') {
        next = next.filter(p => p !== 'Auxiliary Pioneer');
      }
      if (privilege === 'Auxiliary Pioneer') {
        next = next.filter(p => p !== 'Regular Pioneer');
      }
      return { ...prev, privileges: next };
    });
  };

  const allPrivileges: Privilege[] = [
    "Elder",
    "Ministerial Servant", 
    "Regular Pioneer",
    "Auxiliary Pioneer",
    "Secretary",
    "Coordinator",
    "Group Overseer"
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

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </form>
  );
}
