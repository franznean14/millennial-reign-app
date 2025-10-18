"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Home, Landmark, Briefcase, User, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthButtons } from "@/components/auth/AuthButtons";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import InstallPrompt from "@/components/InstallPrompt";

interface AppTopbarProps {
  currentSection: string;
  onSectionChange: (section: string) => void;
  userPermissions: {
    showCongregation: boolean;
    showBusiness: boolean;
  };
}

export function AppTopbar({ currentSection, onSectionChange, userPermissions }: AppTopbarProps) {
  const navItems = [
    { id: 'home', label: "Home", icon: Home },
    ...(userPermissions.showCongregation ? [{ id: 'congregation', label: "Congregation", icon: Landmark }] : []),
    ...(userPermissions.showBusiness ? [{ id: 'business', label: "BWI", icon: Briefcase }] : []),
    { id: 'account', label: "Account", icon: User },
  ];

  const handleNavClick = (sectionId: string) => {
    onSectionChange(sectionId);
  };

  return (
    <header className="sticky top-0 z-20 w-full border-b border-border/80 bg-background/70 backdrop-blur">
      <div className="mx-auto max-w-screen-lg px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Mobile Menu */}
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

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ id, label, icon: Icon }) => {
              const isActive = currentSection === id;
              return (
                <Button
                  key={id}
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => handleNavClick(id)}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <OfflineIndicator variant="inline" />
          <InstallPrompt />
          <ThemeToggle />
          <AuthButtons />
        </div>
      </div>
    </header>
  );
}
