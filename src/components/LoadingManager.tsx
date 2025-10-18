"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface LoadingState {
  auth: boolean;
  navigation: boolean;
  content: boolean;
  isFullyLoaded: boolean;
}

interface LoadingManagerContextType {
  loadingState: LoadingState;
  setLoadingState: (key: keyof Omit<LoadingState, 'isFullyLoaded'>, value: boolean) => void;
  isAppReady: boolean;
}

const LoadingManagerContext = createContext<LoadingManagerContextType | undefined>(undefined);

export function LoadingManager({ children }: { children: ReactNode }) {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    auth: true,
    navigation: true,
    content: true,
    isFullyLoaded: false,
  });

  const updateLoadingState = useCallback((key: keyof Omit<LoadingState, 'isFullyLoaded'>, value: boolean) => {
    setLoadingState(prev => {
      const newState = { ...prev, [key]: value };
      const isFullyLoaded = !newState.auth && !newState.navigation && !newState.content;
      return { ...newState, isFullyLoaded };
    });
  }, []);

  const isAppReady = loadingState.isFullyLoaded;

  return (
    <LoadingManagerContext.Provider value={{
      loadingState,
      setLoadingState: updateLoadingState,
      isAppReady,
    }}>
      {children}
    </LoadingManagerContext.Provider>
  );
}

export function useLoadingManager() {
  const context = useContext(LoadingManagerContext);
  if (context === undefined) {
    throw new Error('useLoadingManager must be used within a LoadingManager');
  }
  return context;
}
