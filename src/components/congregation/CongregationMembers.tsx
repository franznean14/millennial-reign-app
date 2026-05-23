"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cacheGet, cacheSet } from "@/lib/offline/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Crown, Shield, Users, ChevronRight } from "lucide-react";
import { UserManagementForm } from "./UserManagementForm";
import { FormModal } from "@/components/shared/FormModal";
import type { Profile } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerWideRightContent,
} from "@/components/ui/drawer";
import {
  CONG_BWI_BADGE_CLASS,
  CONG_ROLE_BADGE_CLASSES,
  getPrimaryRoleDisplay,
} from "@/lib/utils/congregation-member-roles";
import { studyBibleDarkClasses, studyBibleSectionToggle } from "@/lib/theme/study-bible-dark";

const GUEST_MEMBERS_TAB = "__cong_guest_members__";

type CongregationMember = Pick<
  Profile,
  | "id"
  | "first_name"
  | "last_name"
  | "username"
  | "avatar_url"
  | "privileges"
  | "group_name"
  | "congregation_id"
  | "role"
  | "gender"
  | "is_congregation_guest"
>;

interface CongregationMembersProps {
  congregationId: string;
  currentUserId: string | null;
  /** Elders and platform admins may edit members; others see Manage User as read-only. */
  canManageCongregationUsers: boolean;
}

export function CongregationMembers({
  congregationId,
  currentUserId,
  canManageCongregationUsers,
}: CongregationMembersProps) {
  const [members, setMembers] = useState<CongregationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<CongregationMember | null>(null);
  const [userManagementModalOpen, setUserManagementModalOpen] = useState(false);
  const [membersDrawerOpen, setMembersDrawerOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>("All");
  /** Active BWI participants in this congregation (for list badges). */
  const [bwiParticipantIds, setBwiParticipantIds] = useState<Set<string>>(() => new Set());
  const previousCongregationIdRef = useRef<string | null>(null);
  const isMdUp = useMediaQuery("(min-width: 768px)");

  /**
   * Cache-first: show IndexedDB immediately, refresh in background without a loading flash.
   * `silent`: background refresh (e.g. after congregation-refresh) — no loading toggles.
   */
  const loadMembers = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      const membersCacheKey = `cong:members:${congregationId}`;
      const bwiCacheKey = `cong:members:bwi:${congregationId}`;
      let hadMembersCache = false;

      if (!silent) {
        try {
          const [cachedMembers, cachedBwi] = await Promise.all([
            cacheGet<CongregationMember[]>(membersCacheKey),
            cacheGet<string[]>(bwiCacheKey),
          ]);
          if (cachedMembers != null) {
            hadMembersCache = true;
            setMembers(cachedMembers);
            if (Array.isArray(cachedBwi)) {
              setBwiParticipantIds(new Set(cachedBwi));
            }
            setLoading(false);
          }
        } catch {
          // ignore cache read errors
        }
        if (!hadMembersCache) {
          setLoading(true);
        }
      }

      const supabase = createSupabaseBrowserClient();
      try {
        const [profilesRes, bwiRes] = await Promise.all([
          supabase
            .from("profiles")
            .select(
              "id, first_name, last_name, username, avatar_url, privileges, group_name, congregation_id, role, gender, is_congregation_guest",
            )
            .eq("congregation_id", congregationId)
            .order("last_name")
            .order("first_name"),
          supabase
            .from("business_participants")
            .select("user_id")
            .eq("congregation_id", congregationId)
            .eq("active", true),
        ]);

        const { data: profiles, error: profilesError } = profilesRes;
        if (profilesError) throw profilesError;

        if (profiles) {
          const list = profiles as CongregationMember[];
          setMembers(list);
          await cacheSet(membersCacheKey, list);
        }

        const bwiRows = bwiRes.data;
        if (!bwiRes.error && bwiRows) {
          const ids = bwiRows.map((r) => r.user_id);
          setBwiParticipantIds(new Set(ids));
          await cacheSet(bwiCacheKey, ids);
        } else if (bwiRes.error) {
          console.warn("BWI participants list:", bwiRes.error);
        }
      } catch (error) {
        console.error("Error loading congregation members:", error);
      } finally {
        if (!silent && !hadMembersCache) {
          setLoading(false);
        }
      }
    },
    [congregationId],
  );

  useEffect(() => {
    const prev = previousCongregationIdRef.current;
    previousCongregationIdRef.current = congregationId;
    if (prev !== null && prev !== congregationId) {
      setMembers([]);
      setBwiParticipantIds(new Set());
      setLoading(true);
    }
    void loadMembers();
  }, [congregationId, loadMembers]);

  const groupTabValues = useMemo(() => {
    const set = new Set<string>();
    for (const m of members) {
      if (m.is_congregation_guest) {
        if (m.group_name) set.add(m.group_name);
        continue;
      }
      set.add(m.group_name || "No Group");
    }
    const sorted = Array.from(set)
      .filter((g) => g !== "Guest")
      .sort((a, b) => a.localeCompare(b));
    return ["All", ...sorted, GUEST_MEMBERS_TAB] as string[];
  }, [members]);

  // Default group to the current user's group when possible
  useEffect(() => {
    if (!currentUserId || members.length === 0) return;
    const me = members.find((m) => m.id === currentUserId);
    if (!me) return;
    const preferred = me.is_congregation_guest
      ? GUEST_MEMBERS_TAB
      : me.group_name || "No Group";
    if (groupTabValues.includes(preferred)) setActiveGroup(preferred);
    else setActiveGroup("All");
  }, [currentUserId, members, groupTabValues]);

  useEffect(() => {
    if (!groupTabValues.includes(activeGroup)) setActiveGroup("All");
  }, [groupTabValues, activeGroup]);

  // Listen for refresh events (silent = no loading flash; data already on screen)
  useEffect(() => {
    const handleRefresh = () => {
      void loadMembers({ silent: true });
    };

    window.addEventListener("congregation-refresh", handleRefresh);
    return () => {
      window.removeEventListener("congregation-refresh", handleRefresh);
    };
  }, [loadMembers]);

  const handleUserUpdated = (updatedUser: any) => {
    void loadMembers({ silent: true });
    setUserManagementModalOpen(false);
    setSelectedUser(null);
  };

  const getPrivilegeIcon = (privileges: string[]) => {
    if (privileges.includes('Group Overseer')) return <Crown className="h-3 w-3 text-yellow-600" />;
    if (privileges.includes('Group Assistant')) return <Shield className="h-3 w-3 text-blue-600" />;
    return null;
  };

  const filteredMembers =
    activeGroup === GUEST_MEMBERS_TAB
      ? members.filter((m) => !!m.is_congregation_guest)
      : activeGroup === "All"
        ? members
        : activeGroup === "No Group"
          ? members.filter(
              (m) => !m.is_congregation_guest && (m.group_name || "No Group") === "No Group",
            )
          : members.filter((m) => (m.group_name || "No Group") === activeGroup);

  const previewMembers = (() => {
    if (members.length === 0) return [];
    const me = currentUserId ? members.find((m) => m.id === currentUserId) : undefined;
    if (me?.is_congregation_guest) {
      const guestOthers = members
        .filter((m) => m.id !== me.id && !!m.is_congregation_guest)
        .slice(0, 2);
      return [me, ...guestOthers];
    }
    const myGroup = me?.group_name || "No Group";
    const myGroupOthers = members
      .filter((m) => m.id !== me?.id && (m.group_name || "No Group") === myGroup)
      .slice(0, 2);
    if (me) return [me, ...myGroupOthers];
    return members.slice(0, 3);
  })();

  const MembersRow = ({ member, compact }: { member: CongregationMember; compact?: boolean }) => {
    const initials = `${member.first_name?.[0] || ""}${member.last_name?.[0] || ""}`.toUpperCase() || "U";
    const role = getPrimaryRoleDisplay(member.privileges);
    const showBwi = bwiParticipantIds.has(member.id);
    return (
      <div className={compact ? "" : "px-3 py-2"} role="row">
        <div className="flex items-center gap-3">
          <Avatar className={compact ? "h-9 w-9" : "h-8 w-8"}>
            <AvatarImage src={member.avatar_url || undefined} />
            <AvatarFallback className={compact ? "text-[11px] font-semibold" : "text-[10px] font-semibold"}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                <p className="truncate text-sm font-medium text-foreground dark:text-[#fffaff]">
                  {member.first_name} {member.last_name}
                </p>
                {member.is_congregation_guest ? (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-4 leading-none shrink-0 font-normal"
                  >
                    Guest
                  </Badge>
                ) : null}
                {getPrivilegeIcon(member.privileges)}
              </div>
              {(role || showBwi) ? (
                <div className="flex flex-wrap gap-1 justify-end shrink-0 max-w-[50%]">
                  {role ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0 h-4 leading-none font-medium border",
                        CONG_ROLE_BADGE_CLASSES[role.tone],
                      )}
                    >
                      {role.label}
                    </Badge>
                  ) : null}
                  {showBwi ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0 h-4 leading-none font-medium border",
                        CONG_BWI_BADGE_CLASS,
                      )}
                    >
                      BWI
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const membersDirectoryBody = (
    <>
      <div className="flex justify-center">
        <div className={cn("relative w-full max-w-screen-sm", studyBibleSectionToggle.shell)}>
          <div className="no-scrollbar w-full overflow-x-auto">
            <ToggleGroup
              type="single"
              value={activeGroup}
              onValueChange={(v) => {
                if (v) setActiveGroup(v);
              }}
              className={cn(studyBibleSectionToggle.group, "w-max justify-center")}
            >
              {groupTabValues.map((g) => (
                <ToggleGroupItem
                  key={g}
                  value={g}
                  className={cn(
                    studyBibleSectionToggle.item,
                    studyBibleSectionToggle.itemCompact,
                    "min-h-12 max-w-[100px] py-2"
                  )}
                  title={g === GUEST_MEMBERS_TAB ? "Guest" : g}
                >
                  <span className="w-full whitespace-normal break-words text-center text-[11px] font-medium">
                    {g === GUEST_MEMBERS_TAB ? "Guest" : g}
                  </span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex w-full flex-col overflow-hidden overscroll-none rounded-xl border border-border dark:border-[#1c1921] bg-card dark:bg-[#181714]",
          isMdUp ? "min-h-0 flex-1" : "h-[calc(70vh)]"
        )}
      >
        <div className="flex-shrink-0 border-b bg-card border-border dark:border-[#1c1921] dark:bg-[#30283c]">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="border-b border-border dark:border-[#1c1921]">
                <th className="w-[70%] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-[#ded6e7]">
                  Name
                </th>
                <th className="w-[30%] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-[#ded6e7]">
                  Role
                </th>
              </tr>
            </thead>
          </table>
        </div>

        <div
          className="no-scrollbar flex-1 overflow-y-auto overscroll-none bg-card dark:bg-[#181714]"
          style={{ overscrollBehavior: "contain", touchAction: "pan-y" }}
        >
          <table className="w-full table-fixed text-sm">
            <tbody>
              {filteredMembers.map((member) => {
                const initials =
                  `${member.first_name?.[0] || ""}${member.last_name?.[0] || ""}`.toUpperCase() || "U";
                const role = getPrimaryRoleDisplay(member.privileges);
                const showBwi = bwiParticipantIds.has(member.id);
                return (
                  <tr
                    key={member.id}
                    className="cursor-pointer border-b transition-colors hover:bg-muted/30 dark:border-[#3a3342] dark:hover:bg-[#2a2534]"
                    onClick={() => {
                      setSelectedUser(member);
                      setUserManagementModalOpen(true);
                    }}
                  >
                    <td className="w-[70%] min-w-0 p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px] font-semibold">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="truncate text-foreground dark:text-[#fffaff]">
                              {member.first_name} {member.last_name}
                            </span>
                            {member.is_congregation_guest ? (
                              <Badge
                                variant="secondary"
                                className="h-4 shrink-0 px-1.5 py-0 text-[10px] font-normal leading-none"
                              >
                                Guest
                              </Badge>
                            ) : null}
                            {getPrivilegeIcon(member.privileges)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="w-[30%] p-3 align-top">
                      <div className="flex flex-wrap justify-end gap-1">
                        {role ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-4 border px-1.5 py-0 text-[10px] font-medium leading-none",
                              CONG_ROLE_BADGE_CLASSES[role.tone]
                            )}
                          >
                            {role.label}
                          </Badge>
                        ) : null}
                        {showBwi ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-4 border px-1.5 py-0 text-[10px] font-medium leading-none",
                              CONG_BWI_BADGE_CLASS
                            )}
                            title="Business Witnessing Initiative participant"
                          >
                            BWI
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  return (
    <>
      <Card
        className={cn(
          "min-w-0 gap-0 overflow-hidden rounded-xl border py-0 shadow-md",
          studyBibleDarkClasses.bwiCard
        )}
      >
        <CardHeader className="rounded-t-xl border-b px-4 pt-3 !pb-3 border-border dark:border-[#1c1921] dark:bg-[#2a2534]">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-md text-left transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80778e] focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-offset-[#181714]"
            onClick={() => setMembersDrawerOpen(true)}
          >
            <CardTitle className="flex items-center gap-2 text-base font-bold leading-tight text-foreground dark:text-[#fffaff]">
              <Users className="h-5 w-5 shrink-0 opacity-90" />
              Congregation Members
            </CardTitle>
            <ChevronRight className="h-4 w-4 shrink-0 opacity-70 text-muted-foreground dark:text-[#ded6e7]" />
          </button>
        </CardHeader>
        <CardContent className="space-y-2 p-0 pb-6 pt-2">
          {loading ? (
            <div className="px-4 pb-4 text-sm text-muted-foreground dark:text-[#ded6e7]/80">Loading...</div>
          ) : previewMembers.length === 0 ? (
            <div className="px-4 pb-6 text-sm text-muted-foreground dark:text-[#ded6e7]/75">No members found.</div>
          ) : (
            <div className="space-y-2 px-4 py-2">
              {previewMembers.map((member) => (
                <div
                  key={member.id}
                  className="cursor-pointer rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50 dark:hover:bg-[#2a2534]/85"
                  role="button"
                  tabIndex={0}
                  onClick={() => setMembersDrawerOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setMembersDrawerOpen(true);
                    }
                  }}
                >
                  <MembersRow member={member} compact />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isMdUp ? (
        <Drawer
          open={membersDrawerOpen}
          onOpenChange={setMembersDrawerOpen}
          direction="right"
          modal
          shouldScaleBackground={false}
        >
          <DrawerWideRightContent className="flex flex-col overflow-hidden border-border dark:border-[#1c1921] bg-card dark:bg-[#181714] text-foreground dark:text-[#fffaff] md:max-h-[100lvh]">
            <DrawerHeader className="shrink-0 px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center bg-card dark:bg-[#181714]">
              <DrawerTitle className="text-center text-lg font-bold">Congregation Members</DrawerTitle>
              <DrawerDescription className="sr-only">
                Browse and filter congregation members by group or role.
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+28px)] pt-4">
              {membersDirectoryBody}
            </div>
          </DrawerWideRightContent>
        </Drawer>
      ) : (
        <FormModal open={membersDrawerOpen} onOpenChange={setMembersDrawerOpen} title="Congregation Members">
          <div className="space-y-4">{membersDirectoryBody}</div>
        </FormModal>
      )}

      {/* Manage User: left sheet on tablet+ (stack above members right drawer), bottom sheet on phone */}
      <FormModal
        open={userManagementModalOpen}
        onOpenChange={setUserManagementModalOpen}
        title="Manage User"
        desktopPresentation="left-sheet"
        className="border-border dark:border-[#1c1921] bg-card dark:bg-[#181714] md:max-h-[100lvh]"
        headerClassName="text-center"
      >
        {selectedUser && (
          <UserManagementForm
            user={selectedUser}
            allowManage={canManageCongregationUsers}
            onSaved={handleUserUpdated}
            onClose={() => {
              setUserManagementModalOpen(false);
              setSelectedUser(null);
            }}
          />
        )}
      </FormModal>
    </>
  );
}
