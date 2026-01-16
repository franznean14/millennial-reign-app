"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Crown, Shield } from "lucide-react";
import { UserManagementForm } from "./UserManagementForm";
import { FormModal } from "@/components/shared/FormModal";

interface CongregationMember {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  privileges: string[];
  group_name: string | null;
  congregation_id: string | null; // Add this
}

interface GroupedMembers {
  [groupName: string]: CongregationMember[];
}

interface CongregationMembersProps {
  congregationId: string;
}

export function CongregationMembers({ congregationId }: CongregationMembersProps) {
  const [members, setMembers] = useState<GroupedMembers>({});
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedUser, setSelectedUser] = useState<CongregationMember | null>(null);
  const [userManagementModalOpen, setUserManagementModalOpen] = useState(false);

  // Load congregation members
  const loadMembers = async () => {
    const supabase = createSupabaseBrowserClient();
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, privileges, group_name, congregation_id') // Add congregation_id and email
        .eq('congregation_id', congregationId)
        .order('last_name')
        .order('first_name');

      if (profiles) {
        // Group members by group name
        const grouped: GroupedMembers = {};
        profiles.forEach((member: CongregationMember) => {
          const groupName = member.group_name || 'No Group';
          if (!grouped[groupName]) {
            grouped[groupName] = [];
          }
          grouped[groupName].push(member);
        });
        setMembers(grouped);
      }
    } catch (error) {
      console.error('Error loading congregation members:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [congregationId]);

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
    // Refresh the members list
    setRefreshKey(prev => prev + 1);
    setUserManagementModalOpen(false);
    setSelectedUser(null);
  };

  const getPrivilegeIcon = (privileges: string[]) => {
    if (privileges.includes('Group Overseer')) return <Crown className="h-3 w-3 text-yellow-600" />;
    if (privileges.includes('Group Assistant')) return <Shield className="h-3 w-3 text-blue-600" />;
    return null;
  };

  const getPrivilegeBadge = (privileges: string[]) => {
    if (privileges.includes('Elder')) return <Badge variant="default" className="text-xs">Elder</Badge>;
    if (privileges.includes('Ministerial Servant')) return <Badge variant="secondary" className="text-xs">MS</Badge>;
    if (privileges.includes('Regular Pioneer')) return <Badge variant="outline" className="text-xs">Regular Pioneer</Badge>;
    if (privileges.includes('Auxiliary Pioneer')) return <Badge variant="outline" className="text-xs">Aux Pioneer</Badge>;
    return null;
  };

  if (loading) {
    return <div className="text-sm opacity-70">Loading members...</div>;
  }

  return (
    <>
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Congregation Members</h2>
        </div>
        
        <div className="space-y-4">
          {Object.entries(members).map(([groupName, groupMembers]) => (
            <Card key={groupName}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {groupName}
                  <Badge variant="outline" className="text-xs">
                    {groupMembers.length} {groupMembers.length === 1 ? 'member' : 'members'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {groupMembers.map((member) => (
                    <div 
                      key={member.id} 
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted cursor-pointer"
                      onClick={() => {
                        setSelectedUser(member);
                        setUserManagementModalOpen(true);
                      }}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="text-sm">
                          {`${member.first_name?.[0] || ''}${member.last_name?.[0] || ''}`.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            {member.first_name} {member.last_name}
                          </span>
                          {getPrivilegeIcon(member.privileges)}
                          {getPrivilegeBadge(member.privileges)}
                        </div>
                        {member.privileges.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {member.privileges
                              .filter(p => !['Elder', 'Ministerial Servant', 'Regular Pioneer', 'Auxiliary Pioneer', 'Group Overseer', 'Group Assistant'].includes(p))
                              .map((privilege) => (
                                <Badge key={privilege} variant="secondary" className="text-xs">
                                  {privilege}
                                </Badge>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

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
