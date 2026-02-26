"use client";

import { useState, useEffect } from "react";
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

type CongregationMember = Pick<
  Profile,
  "id" | "first_name" | "last_name" | "username" | "avatar_url" | "privileges" | "group_name" | "congregation_id" | "role" | "gender"
>;

interface CongregationMembersProps {
  congregationId: string;
  currentUserId: string | null;
}

export function CongregationMembers({ congregationId, currentUserId }: CongregationMembersProps) {
  const [members, setMembers] = useState<CongregationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<CongregationMember | null>(null);
  const [userManagementModalOpen, setUserManagementModalOpen] = useState(false);
  const [membersDrawerOpen, setMembersDrawerOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>("All");

  const MEMBERS_CACHE_KEY = `cong:members:${congregationId}`;

  // Load congregation members: cache-first for offline, then network
  const loadMembers = async () => {
    setLoading(true);
    try {
      const cached = await cacheGet<CongregationMember[]>(MEMBERS_CACHE_KEY);
      if (cached?.length !== undefined) {
        setMembers(cached);
      }
    } catch (_) {}

    const supabase = createSupabaseBrowserClient();
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, username, avatar_url, privileges, group_name, congregation_id, role, gender')
        .eq('congregation_id', congregationId)
        .order('last_name')
        .order('first_name');

      if (profiles) {
        const list = profiles as CongregationMember[];
        setMembers(list);
        await cacheSet(MEMBERS_CACHE_KEY, list);
      }
    } catch (error) {
      console.error('Error loading congregation members:', error);
      // Keep cached members if network failed
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [congregationId]);

  // Default group to the current user's group when possible
  useEffect(() => {
    if (!currentUserId || members.length === 0) return;
    const me = members.find((m) => m.id === currentUserId);
    if (!me) return;
    setActiveGroup(me.group_name || "No Group");
  }, [currentUserId, members]);

  // Listen for refresh events
  useEffect(() => {
    const handleRefresh = () => {
      loadMembers();
    };

    window.addEventListener('congregation-refresh', handleRefresh);
    return () => {
      window.removeEventListener('congregation-refresh', handleRefresh);
    };
  }, []);

  const handleUserUpdated = (updatedUser: any) => {
    loadMembers();
    setUserManagementModalOpen(false);
    setSelectedUser(null);
  };

  const getPrivilegeIcon = (privileges: string[]) => {
    if (privileges.includes('Group Overseer')) return <Crown className="h-3 w-3 text-yellow-600" />;
    if (privileges.includes('Group Assistant')) return <Shield className="h-3 w-3 text-blue-600" />;
    return null;
  };

  const getPrimaryPrivilege = (privileges: string[]) => {
    if (privileges.includes("Elder")) return "Elder";
    if (privileges.includes("Ministerial Servant")) return "MS";
    if (privileges.includes("Regular Pioneer")) return "RP";
    if (privileges.includes("Auxiliary Pioneer")) return "AP";
    return "";
  };

  const getPrivilegeBadge = (privileges: string[]) => {
    if (privileges.includes('Elder')) return <Badge variant="default" className="text-xs">Elder</Badge>;
    if (privileges.includes('Ministerial Servant')) return <Badge variant="secondary" className="text-xs">MS</Badge>;
    if (privileges.includes('Regular Pioneer')) return <Badge variant="outline" className="text-xs">Regular Pioneer</Badge>;
    if (privileges.includes('Auxiliary Pioneer')) return <Badge variant="outline" className="text-xs">Aux Pioneer</Badge>;
    return null;
  };

  const groupNames = (() => {
    const set = new Set<string>();
    for (const m of members) set.add(m.group_name || "No Group");
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  })();

  const filteredMembers =
    activeGroup === "All" ? members : members.filter((m) => (m.group_name || "No Group") === activeGroup);

  const previewMembers = (() => {
    if (members.length === 0) return [];
    const me = currentUserId ? members.find((m) => m.id === currentUserId) : undefined;
    const myGroup = me?.group_name || "No Group";
    const myGroupOthers = members
      .filter((m) => m.id !== me?.id && (m.group_name || "No Group") === myGroup)
      .slice(0, 2);
    if (me) return [me, ...myGroupOthers];
    return members.slice(0, 3);
  })();

  const MembersRow = ({ member, compact }: { member: CongregationMember; compact?: boolean }) => {
    const initials = `${member.first_name?.[0] || ""}${member.last_name?.[0] || ""}`.toUpperCase() || "U";
    const primary = getPrimaryPrivilege(member.privileges);
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
              <div className="min-w-0 flex items-center gap-2">
                <p className={compact ? "text-sm font-medium truncate" : "text-sm font-medium truncate"}>
                  {member.first_name} {member.last_name}
                </p>
                {getPrivilegeIcon(member.privileges)}
              </div>
              {primary ? (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 leading-none flex-shrink-0">
                  {primary}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card className="gap-2">
        <CardHeader>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-3 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => setMembersDrawerOpen(true)}
          >
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5" />
              Congregation Members
            </CardTitle>
            <ChevronRight className="h-4 w-4 opacity-70" />
          </button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="px-4 pb-4 text-sm text-muted-foreground">Loading...</div>
          ) : previewMembers.length === 0 ? (
            <div className="px-4 pb-6 text-sm text-muted-foreground">No members found.</div>
          ) : (
            <div className="px-4 py-2 space-y-2">
              {previewMembers.map((member) => (
                <div
                  key={member.id}
                  className="px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
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

      <FormModal
        open={membersDrawerOpen}
        onOpenChange={setMembersDrawerOpen}
        title="Congregation Members"
      >
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="bg-background/95 backdrop-blur-sm border p-0.1 rounded-lg shadow-lg w-full max-w-screen-sm relative overflow-hidden">
              <div className="w-full overflow-x-auto no-scrollbar">
                <ToggleGroup
                  type="single"
                  value={activeGroup}
                  onValueChange={(v) => {
                    if (v) setActiveGroup(v);
                  }}
                  className="w-max min-w-full h-full justify-center"
                >
                  {groupNames.map((g) => (
                    <ToggleGroupItem
                      key={g}
                      value={g}
                      className="data-[state=on]:!bg-primary data-[state=on]:!text-primary-foreground data-[state=on]:shadow-sm min-w-0 max-w-[100px] px-3 min-h-12 py-2 flex items-center justify-center transition-colors"
                      title={g}
                    >
                      <span className="text-[11px] font-medium text-center whitespace-normal break-words w-full">{g}</span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </div>
          </div>

          <div className="w-full h-[calc(70vh)] overflow-hidden flex flex-col overscroll-none">
            {/* Fixed Table Header */}
            <div className="flex-shrink-0 border-b bg-background">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-3 w-[70%]">Name</th>
                    <th className="text-left py-3 px-3 w-[30%]">Role</th>
                  </tr>
                </thead>
              </table>
            </div>

            {/* Scrollable Table Body */}
            <div
              className="flex-1 overflow-y-auto no-scrollbar overscroll-none"
              style={{ overscrollBehavior: "contain", touchAction: "pan-y" }}
            >
              <table className="w-full text-sm table-fixed">
                <tbody>
                  {filteredMembers.map((member) => {
                    const initials = `${member.first_name?.[0] || ""}${member.last_name?.[0] || ""}`.toUpperCase() || "U";
                    const primary = getPrimaryPrivilege(member.privileges);
                    return (
                      <tr
                        key={member.id}
                        className="border-b hover:bg-muted/30 cursor-pointer"
                        onClick={() => {
                          setSelectedUser(member);
                          setUserManagementModalOpen(true);
                        }}
                      >
                        <td className="p-3 min-w-0 w-[70%]">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={member.avatar_url || undefined} />
                              <AvatarFallback className="text-[10px] font-semibold">{initials}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate">
                                  {member.first_name} {member.last_name}
                                </span>
                                {getPrivilegeIcon(member.privileges)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 w-[30%]">
                          {primary ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 leading-none">
                              {primary}
                            </Badge>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </FormModal>

      {/* User Management Modal */}
      <FormModal
        open={userManagementModalOpen}
        onOpenChange={setUserManagementModalOpen}
        title="Manage User"
        description="Edit user privileges, congregation, and group assignments"
        className="sm:max-w-2xl"
      >
        {selectedUser && (
          <UserManagementForm
            user={selectedUser}
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
