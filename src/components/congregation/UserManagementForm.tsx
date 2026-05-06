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
import { cn } from "@/lib/utils";
import { sidebarFormClasses } from "@/components/business/sidebar-form-styles";

interface UserManagementFormProps {
  user: Profile;
  onSaved: (profile: Profile) => void;
  onClose: () => void;
  /** When false, all fields are read-only (view-only). DB still enforces permissions. */
  allowManage?: boolean;
}

// Elders and platform admins can edit; others may open the modal to view only.
// Security is enforced at the database level via RLS policies
export function UserManagementForm({
  user,
  onSaved,
  onClose,
  allowManage = true,
}: UserManagementFormProps) {
  const [saving, setSaving] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [bwiEnabled, setBwiEnabled] = useState(false);
  const [isBwiParticipant, setIsBwiParticipant] = useState(false);
  const [groupOptions, setGroupOptions] = useState<string[]>([]);
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [congregationOptions, setCongregationOptions] = useState<Array<{id: string, name: string}>>([]);
  const [animatePrivilegeTransitions, setAnimatePrivilegeTransitions] = useState(false);
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

  // Avoid mount animation delay when opening the drawer;
  // enable motion right after first paint so only toggle changes animate.
  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      setAnimatePrivilegeTransitions(true);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, []);

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
    if (!allowManage) return;
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
    if (!allowManage) return;
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
    if (!allowManage) return;
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

  const displayedPrivileges = allowManage
    ? visiblePrivileges
    : allPrivileges.filter((privilege) => formData.privileges.includes(privilege));
  const showGuestPublisher = allowManage || formData.is_congregation_guest;
  const showGroupAssignment = !formData.is_congregation_guest;

  return (
    <>
    <div className={cn("space-y-6", sidebarFormClasses.form)}>
      {/* User Header */}
      <div
        className={cn(
          "flex items-center gap-4 rounded-xl border p-4",
          sidebarFormClasses.panel,
          "border-border dark:border-[#1c1921]"
        )}
      >
        <Avatar className="h-16 w-16 border border-border dark:border-[#5a5068]/50">
          <AvatarImage src={user.avatar_url || undefined} />
          <AvatarFallback className="bg-muted text-lg dark:bg-[#30283c] dark:text-[#fffaff]">
            {`${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold dark:text-[#fffaff]">
            {user.first_name} {user.last_name}
          </h2>
          <p className="text-sm text-muted-foreground dark:text-[#ded6e7]/75">
            {user.username ? `@${user.username}` : "No username set"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 pb-8">

        {/* Congregation Assignment */}
        <div className="space-y-2">
          <Label className={sidebarFormClasses.label}>Congregation Assignment</Label>
          <Select
            disabled={!allowManage}
            value={formData.congregation_id || "none"}
            onValueChange={(value) => setFormData(prev => ({ 
              ...prev, 
              congregation_id: value === "none" ? null : value 
            }))}
          >
            <SelectTrigger className={cn("h-10", sidebarFormClasses.selectTrigger)}>
              <SelectValue placeholder="Select congregation" />
            </SelectTrigger>
            <SelectContent className={sidebarFormClasses.selectContent}>
              <SelectItem value="none">No congregation</SelectItem>
              {congregationOptions.map((cong) => (
                <SelectItem key={cong.id} value={cong.id}>
                  {cong.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showGuestPublisher && (
          <div className="space-y-2">
            <Label className={sidebarFormClasses.label}>Guest publisher</Label>
            <div
              className={cn(
                "flex items-center justify-between rounded-lg border p-3",
                sidebarFormClasses.panel,
                "dark:border-[#1c1921]"
              )}
            >
              <div className="min-w-0 flex-1 pr-2">
                <div className="text-sm font-medium dark:text-[#fffaff]">Guest publisher</div>
              </div>
              <Switch
                id="cong-guest-switch"
                className="shrink-0"
                disabled={!allowManage}
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
        )}

        {showGroupAssignment && (
          <div className="space-y-2">
            <Label className={sidebarFormClasses.label}>Group Assignment</Label>
            {showGroupInput ? (
              <div className="flex gap-2">
                <Input
                  className={cn("flex-1", sidebarFormClasses.input)}
                  placeholder="Enter new group name"
                  value={formData.group_name}
                  disabled={!allowManage}
                  onChange={(e) => setFormData((prev) => ({ ...prev, group_name: e.target.value }))}
                  autoFocus
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!allowManage}
                  onClick={() => setShowGroupInput(false)}
                  className={sidebarFormClasses.button}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Select
                disabled={!allowManage}
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
                <SelectTrigger className={cn("h-10", sidebarFormClasses.selectTrigger)}>
                  <SelectValue placeholder="Select group or add new" />
                </SelectTrigger>
                <SelectContent className={sidebarFormClasses.selectContent}>
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

        {/* Privileges */}
        <div className="space-y-2">
          <Label className={sidebarFormClasses.label}>Privileges</Label>
          {displayedPrivileges.length === 0 ? (
            <div
              className={cn(
                "rounded-lg border px-3 py-2 text-sm text-muted-foreground",
                sidebarFormClasses.staticField
              )}
            >
              No active privileges.
            </div>
          ) : (
            <AnimatePresence initial={false}>
              <div className="grid grid-cols-2 gap-2">
                {displayedPrivileges.map((privilege) => (
                  <motion.div
                    key={privilege}
                    layout={animatePrivilegeTransitions}
                    initial={animatePrivilegeTransitions ? { opacity: 0, scale: 0.96, y: 4 } : false}
                    animate={animatePrivilegeTransitions ? { opacity: 1, scale: 1, y: 0 } : undefined}
                    exit={{ opacity: 0, scale: 0.96, y: -4 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                  >
                    <Button
                      type="button"
                      variant={formData.privileges.includes(privilege) ? "default" : "outline"}
                      disabled={!allowManage}
                      onClick={() => togglePrivilege(privilege)}
                      className={cn(
                        "w-full justify-start",
                        formData.privileges.includes(privilege)
                          ? sidebarFormClasses.primaryButton
                          : sidebarFormClasses.button
                      )}
                    >
                      {formData.privileges.includes(privilege) ? "✓ " : ""}
                      {privilege}
                    </Button>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>

        {/* BWI Participation */}
        {bwiEnabled && (
          <div className="space-y-2">
            <Label className={sidebarFormClasses.label}>Business Witnessing Initiative (BWI)</Label>
            <div
              className={cn(
                "flex items-center justify-between rounded-lg border p-3",
                sidebarFormClasses.panel,
                "dark:border-[#1c1921]"
              )}
            >
              <div>
                <div className="text-sm font-medium dark:text-[#fffaff]">BWI Participant</div>
              </div>
              <Switch
                disabled={!allowManage}
                checked={isBwiParticipant}
                onCheckedChange={toggleBwiParticipation}
              />
            </div>
          </div>
        )}

        <div
          className={cn(
            "flex flex-wrap items-center gap-2 border-t border-border pt-4 dark:border-[#1c1921]",
            allowManage && user.congregation_id ? "justify-between" : "justify-start"
          )}
        >
          {allowManage && user.congregation_id ? (
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
            {allowManage && hasFormChanges ? (
              <Button type="submit" disabled={saving} className={sidebarFormClasses.primaryButton}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            ) : (
              <Button type="button" variant="outline" className={sidebarFormClasses.button} onClick={onClose}>
                {allowManage ? "Cancel" : "Close"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>

    <Drawer open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen} nested shouldScaleBackground={false}>
      <DrawerContent
        className={cn(
          // Above DrawerWideLeftContentTop (130) and its stacked nested-right variant (160)
          "flex flex-col !z-[171] dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff]",
          "nested-drawer"
        )}
        overlayClassName="!z-[170]"
        style={{ maxHeight: "50vh", height: "50vh" }}
      >
        <div className="flex min-h-0 flex-1 flex-col justify-center px-4">
          <DrawerHeader className="px-4 pb-2 pt-6 text-center sm:text-center">
            <DrawerTitle className="text-center text-lg font-semibold dark:text-[#fffaff]">
              Remove from congregation?
            </DrawerTitle>
          </DrawerHeader>
          <DrawerDescription className="px-2 pb-2 text-center dark:text-[#ded6e7]/85">
            {user.first_name} {user.last_name} will no longer be assigned to this congregation. Their account
            stays active; they can be added again later. Business witnessing (BWI) participation and guest-name
            links for this congregation are cleared.
          </DrawerDescription>
          <DrawerFooter className="flex flex-col gap-3 p-0 pb-2 pt-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className={cn("h-12 w-full", sidebarFormClasses.button)}
              onClick={() => setRemoveConfirmOpen(false)}
              disabled={removing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="lg"
              variant="destructive"
              className="h-12 w-full"
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
