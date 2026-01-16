"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface SPAContextType {
  currentSection: string;
  setCurrentSection: (section: string) => void;
  userPermissions: {
    showCongregation: boolean;
    showBusiness: boolean;
  };
  onSectionChange: (section: string) => void;
  isAuthenticated: boolean;
  refreshAuth: () => void;
  isAppReady: boolean;
  setContentLoading: (loading: boolean) => void;
  navigationStack: string[];
  pushNavigation: (section: string) => void;
  popNavigation: () => string | null;
}

const SPAContext = createContext<SPAContextType | undefined>(undefined);

export function SPAProvider({ children }: { children: ReactNode }) {
  const [currentSection, setCurrentSection] = useState('home'); // Default to home
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userPermissions, setUserPermissions] = useState({
    showCongregation: false,
    showBusiness: false,
  });
  
  // Loading states
  const [authLoading, setAuthLoading] = useState(true);
  const [navigationLoading, setNavigationLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(true);
  
  // Navigation stack for SPA back navigation
  const [navigationStack, setNavigationStack] = useState<string[]>(['home']);
  
  const isAppReady = !authLoading && !navigationLoading && !contentLoading;

  const pushNavigation = (section: string) => {
    setNavigationStack(prev => [...prev, section]);
  };

  const popNavigation = () => {
    setNavigationStack(prev => {
      if (prev.length <= 1) return prev; // Don't pop the last item
      const newStack = [...prev];
      newStack.pop();
      return newStack;
    });
    
    // Get the previous section from the updated stack
    const updatedStack = navigationStack.slice(0, -1);
    const previousSection = updatedStack[updatedStack.length - 1];
    return previousSection || null;
  };

  const handleSectionChange = (section: string) => {
    // Map business subsections to main business section
    const mainSection = section.startsWith('business-') ? 'business' : section;
    setCurrentSection(section);
    pushNavigation(section);
    
    // Update URL without page reload
    const url = new URL(window.location.href);
    url.pathname = mainSection === 'home' ? '/' : `/${mainSection}`;
    window.history.pushState({}, '', url.toString());
  };

  const refreshAuth = () => {
    checkAuth();
  };

  const checkAuth = async () => {
    try {
      setAuthLoading(true);
      const supabase = createSupabaseBrowserClient();
      const { data: { session }, error } = await supabase.auth.getSession();
      
      // Handle specific auth errors
      if (error) {
        console.error('Auth session error:', error);
        
        // If it's a refresh token error, clear the session and redirect to login
        if (error.message?.includes('Refresh Token') || error.message?.includes('Invalid Refresh Token')) {
          console.log('Refresh token invalid, clearing session...');
          await supabase.auth.signOut();
          setIsAuthenticated(false);
          setUserPermissions({
            showCongregation: false,
            showBusiness: false,
          });
          // Redirect to login page
          window.location.href = '/login';
          // Don't return here, let it continue to finally block
        }
      }
      
      if (session?.user) {
        setIsAuthenticated(true);
        
        // Check user permissions
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          const isElder = Array.isArray(profile?.privileges) && profile.privileges.includes('Elder');
          const isSuperadmin = profile?.role === "superadmin";
          const assigned = !!profile?.congregation_id;
          const admin = profile?.role === "admin";
          
          setUserPermissions({
            showCongregation: true, // Show for all authenticated users
            showBusiness: assigned || isSuperadmin || (admin && isElder),
          });
        }

        // If we just signed in from /login, reset to home and clean URL/state
        if (typeof window !== 'undefined') {
          const path = window.location.pathname;
          if (path === '/login' || currentSection === 'login') {
            setCurrentSection('home');
            setNavigationStack(['home']);
            const url = new URL(window.location.href);
            url.pathname = '/';
            window.history.replaceState({}, '', url.toString());
          }
        }
      } else {
        setIsAuthenticated(false);
        setUserPermissions({
          showCongregation: false,
          showBusiness: false,
        });
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
      setUserPermissions({
        showCongregation: false,
        showBusiness: false,
      });
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Set navigation as ready after auth check
  useEffect(() => {
    if (!authLoading) {
      setNavigationLoading(false);
    }
  }, [authLoading]);

  // Listen for auth state changes to handle token refresh failures
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          checkAuth();
        } else if (event === 'SIGNED_IN') {
          checkAuth();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Derive current section from URL on first load and on history navigation
  useEffect(() => {
    const syncFromPath = () => {
      try {
        const path = typeof window !== 'undefined' ? window.location.pathname : '/';
        const seg = path === '/' ? 'home' : path.replace(/^\/+/, '').split('/')[0] || 'home';
        const allowed = new Set(['home','congregation','business','account']);
        if (allowed.has(seg) && seg !== currentSection) {
          setCurrentSection(seg);
        }
      } catch {}
    };
    syncFromPath();
    window.addEventListener('popstate', syncFromPath);
    return () => window.removeEventListener('popstate', syncFromPath);
  }, [currentSection]);

  const value: SPAContextType = {
    currentSection,
    setCurrentSection,
    userPermissions,
    onSectionChange: handleSectionChange,
    isAuthenticated,
    refreshAuth,
    isAppReady,
    setContentLoading,
    navigationStack,
    pushNavigation,
    popNavigation,
  };

  return (
    <SPAContext.Provider value={value}>
      {children}
    </SPAContext.Provider>
  );
}

export function useSPA() {
  const context = useContext(SPAContext);
  if (context === undefined) {
    throw new Error('useSPA must be used within a SPAProvider');
  }
  return context;
}



