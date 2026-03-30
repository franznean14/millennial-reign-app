"use client";

import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { Crosshair } from "lucide-react";

const ALL_CONGREGATION_PRIVILEGES: Privilege[] = [
  "Elder",
  "Ministerial Servant",
  "Regular Pioneer",
  "Auxiliary Pioneer",
  "Secretary",
  "Coordinator",
  "Group Overseer",
  "Group Assistant",
];

interface ProfileFormProps {
  userId: string;
  initialEmail: string | null;
  initialProfile: Profile | null;
  /** User currently has Elder (or superadmin): may edit congregation privileges & BWI; elders may remove Elder from themselves. */
  canEditPrivilegesAndBwi: boolean;
  /** In congregation, not elder/superadmin: self-edit Regular / Auxiliary Pioneer only (enforced in DB trigger). */
  canEditPioneerPrivilegesOnly?: boolean;
  bwiEnabled: boolean;
  isBwiParticipant: boolean;
  onBwiToggle: () => Promise<boolean>;
  onSaved: (profile: Profile) => void;
}

export function ProfileForm({
  userId,
  initialEmail,
  initialProfile,
  canEditPrivilegesAndBwi,
  canEditPioneerPrivilegesOnly = false,
  bwiEnabled,
  isBwiParticipant,
  onBwiToggle,
  onSaved,
}: ProfileFormProps) {
  const [saving, setSaving] = useState(false);
  const [groupOptions, setGroupOptions] = useState<string[]>([]);
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gps, setGps] = useState<string>("");

  // Check if form has changes
  const hasChanges = () => {
    if (!originalFormData) return false;
    
    return (
      formData.first_name !== originalFormData.first_name ||
      formData.last_name !== originalFormData.last_name ||
      formData.middle_name !== originalFormData.middle_name ||
      formData.date_of_birth !== originalFormData.date_of_birth ||
      formData.date_of_baptism !== originalFormData.date_of_baptism ||
      formData.gender !== originalFormData.gender ||
      (canEditPrivilegesAndBwi &&
        JSON.stringify(formData.privileges) !== JSON.stringify(originalFormData.privileges)) ||
      (canEditPioneerPrivilegesOnly &&
        !canEditPrivilegesAndBwi &&
        (!!originalFormData &&
          (formData.privileges.includes("Regular Pioneer") !==
            originalFormData.privileges.includes("Regular Pioneer") ||
            formData.privileges.includes("Auxiliary Pioneer") !==
              originalFormData.privileges.includes("Auxiliary Pioneer")))) ||
      formData.group_name !== originalFormData.group_name ||
      formData.phone_number !== originalFormData.phone_number ||
      formData.address !== originalFormData.address ||
      formData.address_latitude !== originalFormData.address_latitude ||
      formData.address_longitude !== originalFormData.address_longitude
    );
  };

  // Parse GPS string to extract coordinates
  const parseGps = (gpsString: string) => {
    const parts = gpsString.split(',').map(p => p.trim());
    if (parts.length !== 2) return null;
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  };

  // Get current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by this browser");
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setFormData(prev => ({
          ...prev,
          address_latitude: latitude,
          address_longitude: longitude
        }));
        setGps(`${latitude}, ${longitude}`);
        setGpsLoading(false);
        toast.success("Location obtained successfully");
      },
      (error) => {
        console.error("Error getting location:", error);
        toast.error("Failed to get current location");
        setGpsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

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

  // Initialize form data and original data together
  const initialFormData = {
    first_name: initialProfile?.first_name || "",
    last_name: initialProfile?.last_name || "",
    middle_name: initialProfile?.middle_name || "",
    date_of_birth: parseLocalYMD(initialProfile?.date_of_birth),
    date_of_baptism: parseLocalYMD(initialProfile?.date_of_baptism),
    gender: initialProfile?.gender || null,
    privileges: initialProfile?.privileges || [],
    group_name: initialProfile?.group_name || "",
    phone_number: initialProfile?.phone_number || "",
    address: initialProfile?.address || "",
    address_latitude: initialProfile?.address_latitude || null,
    address_longitude: initialProfile?.address_longitude || null,
  };

  const [formData, setFormData] = useState(initialFormData);
  const [originalFormData, setOriginalFormData] = useState(initialFormData);

  // Update original form data when initialProfile changes (async loading)
  useEffect(() => {
    if (initialProfile) {
      const original = {
        first_name: initialProfile.first_name || "",
        last_name: initialProfile.last_name || "",
        middle_name: initialProfile.middle_name || "",
        date_of_birth: parseLocalYMD(initialProfile.date_of_birth),
        date_of_baptism: parseLocalYMD(initialProfile.date_of_baptism),
        gender: initialProfile.gender || null,
        privileges: initialProfile.privileges || [],
        group_name: initialProfile.group_name || "",
        phone_number: initialProfile.phone_number || "",
        address: initialProfile.address || "",
        address_latitude: initialProfile.address_latitude || null,
        address_longitude: initialProfile.address_longitude || null,
      };
      setOriginalFormData(original);
      setFormData(original);
    }
  }, [initialProfile]);

  // Initialize GPS string from coordinates
  useEffect(() => {
    if (formData.address_latitude && formData.address_longitude) {
      setGps(`${formData.address_latitude}, ${formData.address_longitude}`);
    } else {
      setGps("");
    }
  }, [formData.address_latitude, formData.address_longitude]);


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
    
    // Prevent double submission
    if (saving) return;
    
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
        privileges: (() => {
          if (canEditPrivilegesAndBwi) return formData.privileges;
          if (canEditPioneerPrivilegesOnly) {
            const base = [
              ...(originalFormData.privileges?.length
                ? originalFormData.privileges
                : initialProfile?.privileges || []),
            ];
            const without = base.filter(
              (p) => p !== "Regular Pioneer" && p !== "Auxiliary Pioneer",
            );
            const next: Privilege[] = [...without];
            if (formData.privileges.includes("Regular Pioneer")) {
              next.push("Regular Pioneer");
            }
            if (formData.privileges.includes("Auxiliary Pioneer")) {
              next.push("Auxiliary Pioneer");
            }
            return next;
          }
          return originalFormData.privileges?.length
            ? originalFormData.privileges
            : initialProfile?.privileges || [];
        })(),
        avatar_url: initialProfile?.avatar_url, // Preserve existing avatar
        time_zone: initialProfile?.time_zone || null,
        username: initialProfile?.username || null,
        role: initialProfile?.role || "user", // Preserve existing role
        group_name: formData.group_name || null,
        // Contact information fields
        phone_number: formData.phone_number || null,
        address: formData.address || null,
        address_latitude: formData.address_latitude || null,
        address_longitude: formData.address_longitude || null,
        // Don't pass congregation_id - let upsertProfile preserve it automatically
      });

      toast.success("Profile updated successfully");
      
      // Update original form data to reflect the saved state
      setOriginalFormData({ ...formData });
      
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
    setFormData((prev) => {
      if (canEditPioneerPrivilegesOnly && !canEditPrivilegesAndBwi) {
        if (privilege !== "Regular Pioneer" && privilege !== "Auxiliary Pioneer") {
          return prev;
        }
        let next = [...prev.privileges];
        if (prev.privileges.includes(privilege)) {
          next = next.filter((p) => p !== privilege);
        } else {
          next = [...next, privilege];
        }
        if (privilege === "Regular Pioneer") {
          next = next.filter((p) => p !== "Auxiliary Pioneer");
        } else if (privilege === "Auxiliary Pioneer") {
          next = next.filter((p) => p !== "Regular Pioneer");
        }
        return { ...prev, privileges: next };
      }

      let newPrivileges = [...prev.privileges];

      if (prev.privileges.includes(privilege)) {
        newPrivileges = newPrivileges.filter((p) => p !== privilege);
      } else {
        newPrivileges = [...newPrivileges, privilege];
      }

      if (privilege === "Elder") {
        newPrivileges = newPrivileges.filter((p) => p !== "Ministerial Servant");
      } else if (privilege === "Ministerial Servant") {
        newPrivileges = newPrivileges.filter((p) => p !== "Elder");
      }

      if (privilege === "Regular Pioneer") {
        newPrivileges = newPrivileges.filter((p) => p !== "Auxiliary Pioneer");
      } else if (privilege === "Auxiliary Pioneer") {
        newPrivileges = newPrivileges.filter((p) => p !== "Regular Pioneer");
      }

      if (privilege === "Group Overseer") {
        newPrivileges = newPrivileges.filter((p) => p !== "Group Assistant");
      } else if (privilege === "Group Assistant") {
        newPrivileges = newPrivileges.filter((p) => p !== "Group Overseer");
      }

      if (privilege === "Secretary") {
        newPrivileges = newPrivileges.filter((p) => p !== "Coordinator");
      } else if (privilege === "Coordinator") {
        newPrivileges = newPrivileges.filter((p) => p !== "Secretary");
      }

      const isMale = prev.gender === "male";
      const hasElder = newPrivileges.includes("Elder");

      if (!isMale) {
        newPrivileges = newPrivileges.filter(
          (p) => p !== "Elder" && p !== "Ministerial Servant"
        );
      }

      if (!hasElder) {
        newPrivileges = newPrivileges.filter(
          (p) => p !== "Secretary" && p !== "Coordinator" && p !== "Group Overseer"
        );
      }

      const hasElderOrMS =
        newPrivileges.includes("Elder") || newPrivileges.includes("Ministerial Servant");
      if (!hasElderOrMS) {
        newPrivileges = newPrivileges.filter((p) => p !== "Group Assistant");
      }

      return {
        ...prev,
        privileges: newPrivileges,
      };
    });
  };

  const visiblePrivileges = useMemo(() => {
    if (canEditPioneerPrivilegesOnly && !canEditPrivilegesAndBwi) {
      const pioneerChoices: Privilege[] = ["Regular Pioneer", "Auxiliary Pioneer"];
      return pioneerChoices.filter((privilege) => {
        if (
          privilege === "Auxiliary Pioneer" &&
          formData.privileges.includes("Regular Pioneer")
        ) {
          return false;
        }
        if (
          privilege === "Regular Pioneer" &&
          formData.privileges.includes("Auxiliary Pioneer")
        ) {
          return false;
        }
        return true;
      });
    }

    const isMale = formData.gender === "male";
    const hasElder = formData.privileges.includes("Elder");
    const hasMinisterialServant = formData.privileges.includes("Ministerial Servant");
    const hasElderOrMS = hasElder || hasMinisterialServant;

    return ALL_CONGREGATION_PRIVILEGES.filter((privilege) => {
      if ((privilege === "Elder" || privilege === "Ministerial Servant") && !isMale) {
        return false;
      }

      if (privilege === "Ministerial Servant" && hasElder) {
        return false;
      }

      if (privilege === "Auxiliary Pioneer" && formData.privileges.includes("Regular Pioneer")) {
        return false;
      }
      if (privilege === "Regular Pioneer" && formData.privileges.includes("Auxiliary Pioneer")) {
        return false;
      }

      if (privilege === "Group Assistant" && formData.privileges.includes("Group Overseer")) {
        return false;
      }
      if (privilege === "Group Overseer" && formData.privileges.includes("Group Assistant")) {
        return false;
      }

      if (privilege === "Coordinator" && formData.privileges.includes("Secretary")) {
        return false;
      }
      if (privilege === "Secretary" && formData.privileges.includes("Coordinator")) {
        return false;
      }

      if (
        (privilege === "Secretary" ||
          privilege === "Coordinator" ||
          privilege === "Group Overseer") &&
        !hasElder
      ) {
        return false;
      }

      if (privilege === "Group Assistant" && !hasElderOrMS) {
        return false;
      }

      return true;
    });
  }, [
    formData.privileges,
    formData.gender,
    canEditPioneerPrivilegesOnly,
    canEditPrivilegesAndBwi,
  ]);

  const showPrivilegesUi =
    canEditPrivilegesAndBwi || canEditPioneerPrivilegesOnly;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-10">
      {/* Personal Information Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Personal</h3>
        
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
      </div>

      {/* Contact and Address Section */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-lg font-semibold">Contact and Address</h3>
        <div className="space-y-2">
          <Label htmlFor="phone_number">Contact Number</Label>
                 <Input
                   id="phone_number"
                   type="tel"
                   value={formData.phone_number || ""}
                   onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                   placeholder="+63 912 345 6789"
                 />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={formData.address || ""}
            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            placeholder="123 Main St, City, State, ZIP"
          />
          <p className="text-xs text-muted-foreground">
            For emergency contact purposes - visible to congregation elders
          </p>
        </div>

        {/* GPS Coordinates */}
        <div className="space-y-2">
          <Label>GPS Coordinates (Optional)</Label>
          <div className="flex gap-2">
            <Input 
              className="flex-1"
              placeholder="14.5995, 120.9842"
              value={gps}
              onChange={(e) => {
                const v = e.target.value;
                setGps(v);
                const parsed = parseGps(v);
                if (!v.trim()) {
                  setFormData(prev => ({
                    ...prev,
                    address_latitude: null,
                    address_longitude: null
                  }));
                } else if (parsed) {
                  setFormData(prev => ({
                    ...prev,
                    address_latitude: parsed.lat,
                    address_longitude: parsed.lng
                  }));
                }
              }}
            />
            <Button 
              type="button" 
              variant="outline" 
              size="icon"
              onClick={getCurrentLocation}
              disabled={gpsLoading}
              title={gpsLoading ? "Getting location..." : "Use current location"}
            >
              {gpsLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Crosshair className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Enter coordinates manually or use current location for emergency contact purposes
          </p>
        </div>
      </div>

      {/* Congregation Section */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-lg font-semibold">Congregation</h3>
        
        {/* Group Field - Only visible to Elders */}
        {formData.privileges.includes('Elder') && (
          <div className="space-y-2">
            <Label htmlFor="group_name">Group</Label>
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
        )}

        {showPrivilegesUi && (
          <div className="space-y-2">
            <Label>Privileges</Label>
            {canEditPioneerPrivilegesOnly && !canEditPrivilegesAndBwi ? (
              <p className="text-xs text-muted-foreground">
                Update your pioneer status for the congregation. Other assignments are set by elders.
              </p>
            ) : null}
            {/* Match Manage User: AnimatePresence so privilege buttons exit when filtered out */}
            <AnimatePresence initial={false}>
              <div className="grid grid-cols-2 gap-2">
                {visiblePrivileges.map((privilege) => (
                  <motion.div
                    key={privilege}
                    layout
                    initial={{ opacity: 0, scale: 0.96, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: -4 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                  >
                    <Button
                      type="button"
                      variant={formData.privileges.includes(privilege) ? "default" : "outline"}
                      onClick={() => togglePrivilege(privilege)}
                      className="justify-start w-full"
                    >
                      {formData.privileges.includes(privilege) ? "✓ " : ""}
                      {privilege}
                    </Button>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* BWI Participation Section — visible to participants; editable by Elder/admin */}
      {bwiEnabled && (canEditPrivilegesAndBwi || isBwiParticipant) && (
        <div className="space-y-2">
          <Label>Business Witnessing Initiative (BWI)</Label>
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div className="space-y-1">
              <div className="text-sm font-medium">BWI Participant</div>
              <div className="text-xs text-muted-foreground">
                {isBwiParticipant
                  ? "You can access the Business tab in navigation"
                  : canEditPrivilegesAndBwi
                    ? "Enable to access Business Witnessing features"
                    : "Participation is managed by congregation elders/admins"}
              </div>
            </div>
            <Switch
              disabled={!canEditPrivilegesAndBwi}
              checked={isBwiParticipant}
              onCheckedChange={toggleBwiParticipation}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button 
          key={saving ? "saving" : "save"}
          type="submit" 
          disabled={saving || !hasChanges()}
          className={saving ? "opacity-75" : ""}
        >
          {saving ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Saving...
            </div>
          ) : (
            "Update Profile"
          )}
        </Button>
      </div>
    </form>
  );
}
