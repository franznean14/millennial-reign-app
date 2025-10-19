"use client";

import { Home, Landmark, Briefcase, User, Building2, Users, MapPin, ChevronRight } from "lucide-react";
import { useSPA } from "@/components/SPAProvider";
import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { currentSection, userPermissions, onSectionChange } = useSPA();
  const [isBusinessOpen, setIsBusinessOpen] = useState(false);

  const navigationItems = [
    { id: 'home', label: "Home", icon: Home },
    ...(userPermissions.showCongregation ? [{ id: 'congregation', label: "Congregation", icon: Landmark }] : []),
    ...(userPermissions.showBusiness ? [{ id: 'business', label: "BWI", icon: Briefcase, hasSubsections: true }] : []),
    { id: 'account', label: "Account", icon: User },
  ];

  const businessSubsections = [
    { id: 'business-establishments', label: "Establishments", icon: Building2 },
    { id: 'business-householders', label: "Householders", icon: Users },
    { id: 'business-map', label: "Map", icon: MapPin },
  ];

  const handleBusinessClick = () => {
    if (userPermissions.showBusiness) {
      setIsBusinessOpen(!isBusinessOpen);
      if (!isBusinessOpen) {
        onSectionChange('business');
      }
    }
  };

  const handleSubsectionClick = (subsectionId: string) => {
    onSectionChange(subsectionId);
  };

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <span className="text-sm font-semibold">MR</span>
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">Millennial Reign</span>
            <span className="truncate text-xs text-sidebar-foreground/70">Congregation App</span>
          </div>
          <SidebarTrigger />
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map(({ id, label, icon: Icon, hasSubsections }) => {
                const isActive = currentSection === id || (id === 'business' && businessSubsections.some(sub => sub.id === currentSection));
                const isBusinessActive = id === 'business' && businessSubsections.some(sub => sub.id === currentSection);
                
                return (
                  <SidebarMenuItem key={id}>
                    {hasSubsections ? (
                      <>
                        <SidebarMenuButton
                          onClick={handleBusinessClick}
                          isActive={isBusinessActive}
                          tooltip={label}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{label}</span>
                          <ChevronRight className={`ml-auto h-4 w-4 transition-transform ${isBusinessOpen ? 'rotate-90' : ''}`} />
                        </SidebarMenuButton>
                        {isBusinessOpen && (
                          <SidebarMenuSub>
                            {businessSubsections.map(({ id: subId, label: subLabel, icon: SubIcon }) => (
                              <SidebarMenuSubItem key={subId}>
                                <SidebarMenuSubButton
                                  onClick={() => handleSubsectionClick(subId)}
                                  isActive={currentSection === subId}
                                >
                                  <SubIcon className="h-4 w-4" />
                                  <span>{subLabel}</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        )}
                      </>
                    ) : (
                      <SidebarMenuButton
                        onClick={() => onSectionChange(id)}
                        isActive={isActive}
                        tooltip={label}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <div className="px-2 py-2 text-xs text-sidebar-foreground/70">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span>Online</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
