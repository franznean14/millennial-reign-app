"use client";

import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { updateUserProfile } from "@/lib/db/profiles";
import type { Profile, Gender, Privilege } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cacheSet } from "@/lib/offline/store";
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
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [bwiEnabled, setBwiEnabled] = useState(false);
  const [isBwiParticipant, setIsBwiParticipant] = useState(false);
  const [groupOptions, setGroupOptions] = useState<string[]>([]);
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [congregationOptions, setCongregationOptions] = useState<Array<{id: string, name: string}>>([]);
  const [formData, setFormData] = useState({
    privileges: user.privileges || [],
    group_name: user.group_name || "",
    congregation_id: user.congregation_id || null,
    is_congregation_guest: !!user.is_congregation_guest,
  });

  // Update form data when user prop changes
  useEffect(() => {
    setFormData({
      privileges: user.privileges || [],
      group_name: user.is_congregation_guest ? "" : user.group_name || "",
      congregation_id: user.congregation_id || null,
      is_congregation_guest: !!user.is_congregation_guest,
    });
    if (user.is_congregation_guest) setShowGroupInput(false);
  }, [user]);

  const normalizePrivileges = (privileges: Privilege[]) =>
    Array.from(new Set(privileges)).sort();

  const hasFormChanges = useMemo(() => {
    const currentPrivileges = normalizePrivileges(formData.privileges);
    const initialPrivileges = normalizePrivileges(user.privileges || []);

    const privilegesChanged =
      currentPrivileges.length !== initialPrivileges.length ||
      currentPrivileges.some((p, i) => p !== initialPrivileges[i]);

    const currentGroup = formData.is_congregation_guest ? "" : formData.group_name || "";
    const initialGroup = user.is_congregation_guest ? "" : user.group_name || "";

    const currentCongregationId = formData.congregation_id || null;
    const initialCongregationId = user.congregation_id || null;

    return (
      privilegesChanged ||
      currentGroup !== initialGroup ||
      currentCongregationId !== initialCongregationId ||
      formData.is_congregation_guest !== !!user.is_congregation_guest
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
        group_name: formData.is_congregation_guest ? null : formData.group_name || null,
        congregation_id: formData.congregation_id,
        is_congregation_guest: formData.is_congregation_guest,
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

  const handleConfirmCongregationRemove = async () => {
    setRemoving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("remove_user_from_congregation", {
        target_user: user.id,
      });
      if (error) throw error;
      const profile = data as Profile;
      await cacheSet(`profile:${user.id}`, profile);
      toast.success(`${user.first_name} ${user.last_name} removed from this congregation`);
      setRemoveConfirmOpen(false);
      onSaved(profile);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to remove user";
      toast.error(msg);
    } finally {
      setRemoving(false);
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
      }

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

      // Secretary and Coordinator are mutually exclusive
      if (privilege === 'Secretary') {
        newPrivileges = newPrivileges.filter(p => p !== 'Coordinator');
      } else if (privilege === 'Coordinator') {
        newPrivileges = newPrivileges.filter(p => p !== 'Secretary');
      }

      // Enforce visibility rules on the stored list as well:
      const isMale = user.gender === 'male';
      const hasElder = newPrivileges.includes('Elder');

      // Remove male-only privileges for non-male users
      if (!isMale) {
        newPrivileges = newPrivileges.filter(
          (p) => p !== 'Elder' && p !== 'Ministerial Servant'
        );
      }

      // Secretary / Coordinator / Group Overseer only valid when Elder is present
      if (!hasElder) {
        newPrivileges = newPrivileges.filter(
          (p) => p !== 'Secretary' && p !== 'Coordinator' && p !== 'Group Overseer'
        );
      }

      // Group Assistant only valid when Elder or Ministerial Servant is present
      const hasElderOrMS = newPrivileges.includes('Elder') || newPrivileges.includes('Ministerial Servant');
      if (!hasElderOrMS) {
        newPrivileges = newPrivileges.filter((p) => p !== 'Group Assistant');
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

  const visiblePrivileges = useMemo(() => {
    const isMale = user.gender === "male";
    const hasElder = formData.privileges.includes("Elder");
    const hasMinisterialServant = formData.privileges.includes("Ministerial Servant");
    const hasElderOrMS = hasElder || hasMinisterialServant;

    return allPrivileges.filter((privilege) => {
      // Elder / Ministerial Servant are only available for male publishers
      if ((privilege === "Elder" || privilege === "Ministerial Servant") && !isMale) {
        return false;
      }

      // When Elder is selected, hide Ministerial Servant (mutually exclusive)
      if (privilege === "Ministerial Servant" && hasElder) {
        return false;
      }

      // Regular Pioneer and Auxiliary Pioneer are mutually exclusive
      if (privilege === "Auxiliary Pioneer" && formData.privileges.includes("Regular Pioneer")) {
        return false;
      }
      if (privilege === "Regular Pioneer" && formData.privileges.includes("Auxiliary Pioneer")) {
        return false;
      }

      // Group Overseer and Group Assistant are mutually exclusive
      if (privilege === "Group Assistant" && formData.privileges.includes("Group Overseer")) {
        return false;
      }
      if (privilege === "Group Overseer" && formData.privileges.includes("Group Assistant")) {
        return false;
      }

      // Secretary and Coordinator are mutually exclusive
      if (privilege === "Coordinator" && formData.privileges.includes("Secretary")) {
        return false;
      }
      if (privilege === "Secretary" && formData.privileges.includes("Coordinator")) {
        return false;
      }

      // Secretary / Coordinator / Group Overseer only when Elder is active
      if (
        (privilege === "Secretary" ||
          privilege === "Coordinator" ||
          privilege === "Group Overseer") &&
        !hasElder
      ) {
        return false;
      }

      // Group Assistant only when Elder or Ministerial Servant is active
      if (privilege === "Group Assistant" && !hasElderOrMS) {
        return false;
      }

      return true;
    });
  }, [allPrivileges, formData.privileges, user.gender]);

  return (
    <>
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

        <div className="space-y-2">
          <Label>Guest publisher</Label>
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div className="min-w-0 flex-1 space-y-1 pr-2">
              <div className="text-sm font-medium">Guest publisher</div>
              <div className="text-xs text-muted-foreground">
                Shows a Guest badge in the congregation members list and enables the Guest filter tab.
              </div>
            </div>
            <Switch
              id="cong-guest-switch"
              className="shrink-0"
              checked={formData.is_congregation_guest}
              onCheckedChange={(checked) => {
                if (checked) setShowGroupInput(false);
                setFormData((prev) => ({
                  ...prev,
                  is_congregation_guest: checked,
                  ...(checked ? { group_name: "" } : {}),
                }));
              }}
            />
          </div>
        </div>

        {!formData.is_congregation_guest && (
          <div className="space-y-2">
            <Label>Group Assignment</Label>
            {showGroupInput ? (
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  placeholder="Enter new group name"
                  value={formData.group_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, group_name: e.target.value }))}
                  autoFocus
                />
                <Button type="button" variant="outline" onClick={() => setShowGroupInput(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Select
                value={formData.group_name || "none"}
                onValueChange={(value) => {
                  if (value === "__custom__") {
                    setShowGroupInput(true);
                    setFormData((prev) => ({ ...prev, group_name: "" }));
                  } else if (value === "none") {
                    setFormData((prev) => ({ ...prev, group_name: "" }));
                  } else {
                    setFormData((prev) => ({ ...prev, group_name: value }));
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
                  <SelectItem value="__custom__">+ Add new group</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Privileges — no mount-in animation so the drawer feels instant */}
        <div className="space-y-2">
          <Label>Privileges</Label>
          <AnimatePresence initial={false}>
            <div className="grid grid-cols-2 gap-2">
              {visiblePrivileges.map((privilege) => (
                <motion.div
                  key={privilege}
                  initial={false}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.1 }}
                >
                  <Button
                    type="button"
                    variant={formData.privileges.includes(privilege) ? "default" : "outline"}
                    onClick={() => togglePrivilege(privilege)}
                    className="justify-start w-full"
                  >
                    {formData.privileges.includes(privilege) ? "✓ " : ""}{privilege}
                  </Button>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
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

        <div
          className={`flex flex-wrap items-center gap-2 border-t border-border pt-4 ${
            user.congregation_id ? "justify-between" : "justify-start"
          }`}
        >
          {user.congregation_id ? (
            <Button
              type="button"
              variant="destructive"
              className="w-fit shrink-0"
              onClick={() => setRemoveConfirmOpen(true)}
            >
              Remove from congregation
            </Button>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {hasFormChanges ? (
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>

    <Drawer open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
      <DrawerContent
        className="flex flex-col !z-[100]"
        overlayClassName="!z-[100]"
        style={{ maxHeight: "50vh", height: "50vh" }}
      >
        <div className="flex flex-1 flex-col justify-center px-4 min-h-0">
          <DrawerHeader className="pt-6 px-4 pb-2 text-center sm:text-center">
            <DrawerTitle className="text-center">Remove from congregation?</DrawerTitle>
          </DrawerHeader>
          <DrawerDescription className="text-center px-2 pb-2">
            {user.first_name} {user.last_name} will no longer be assigned to this congregation. Their account
            stays active; they can be added again later. Business witnessing (BWI) participation and guest-name
            links for this congregation are cleared.
          </DrawerDescription>
          <DrawerFooter className="flex flex-col gap-3 p-0 pt-4 pb-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full h-12"
              onClick={() => setRemoveConfirmOpen(false)}
              disabled={removing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="lg"
              variant="destructive"
              className="w-full h-12"
              onClick={handleConfirmCongregationRemove}
              disabled={removing}
            >
              {removing ? "Removing…" : "Remove"}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
    </>
  );
}
