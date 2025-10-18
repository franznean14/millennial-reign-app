"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Home, Landmark, Briefcase, User, Menu } from "lucide-react";

interface UnifiedNavProps {
  currentSection: string;
  onSectionChange: (section: string) => void;
  userPermissions: {
    showCongregation: boolean;
    showBusiness: boolean;
  };
}

export function UnifiedNav({ currentSection, onSectionChange, userPermissions }: UnifiedNavProps) {
  const [showCongregation, setShowCongregation] = useState(false);
  const [showBusiness, setShowBusiness] = useState(false);

  useEffect(() => {
    setShowCongregation(userPermissions.showCongregation);
    setShowBusiness(userPermissions.showBusiness);
  }, [userPermissions]);

  const navItems = [
    { id: 'home', label: "Home", icon: Home, href: "/" },
    ...(showCongregation ? [{ id: 'congregation', label: "Congregation", icon: Landmark, href: "/congregation" }] : []),
    ...(showBusiness ? [{ id: 'business', label: "Business", icon: Briefcase, href: "/business" }] : []),
    { id: 'account', label: "Account", icon: User, href: "/account" },
  ];

  const handleNavClick = (sectionId: string) => {
    onSectionChange(sectionId);
  };

  return (
    <>
      {/* Mobile Navigation - Sheet */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open navigation" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle>Millennial Reign</SheetTitle>
          </SheetHeader>
          <nav className="mt-4 grid gap-1">
            {navItems.map(({ id, label, icon: Icon }) => {
              const isActive = currentSection === id;
              return (
                <button
                  key={id}
                  onClick={() => handleNavClick(id)}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors
                    ${isActive ? "bg-muted font-medium" : "hover:bg-muted"}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Desktop Navigation - Sidebar */}
      <nav className="hidden md:flex flex-col w-64 border-r border-border/50 bg-background/50 backdrop-blur">
        <div className="p-4 border-b border-border/50">
          <div className="font-mono text-sm opacity-70">Millennial Reign</div>
        </div>
        <div className="flex-1 p-2">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = currentSection === id;
            return (
              <button
                key={id}
                onClick={() => handleNavClick(id)}
                className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors
                  ${isActive ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Bottom Navigation (Mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/80 backdrop-blur md:hidden pb-[max(env(safe-area-inset-bottom),0.1rem)]">
        <div className="mx-auto flex max-w-screen-sm items-stretch justify-around">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = currentSection === id;
            return (
              <button
                key={id}
                onClick={() => handleNavClick(id)}
                aria-label={label}
                className={`flex flex-col items-center justify-center gap-1 py-3 w-full text-xs
                  ${isActive ? "text-foreground" : "text-foreground/60"}`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "" : "opacity-70"}`} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}