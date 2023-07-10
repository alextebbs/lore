"use client";

import { SessionProvider } from "next-auth/react";
import { createContext, useState } from "react";

interface LayoutProps {
  children: React.ReactNode;
}

interface SidebarCurrentCharacter {
  name: string | null;
  age: string | null;
  species: string | null;
  id: string | null;
}

const blankCharacter: SidebarCurrentCharacter = {
  name: null,
  age: null,
  species: null,
  id: null,
};

export const SidebarContext = createContext({
  sidebarCharacter: blankCharacter,
  setSidebarCharacter: (() => {}) as React.Dispatch<
    React.SetStateAction<SidebarCurrentCharacter>
  >,
});

const Providers: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarCharacter, setSidebarCharacter] =
    useState<SidebarCurrentCharacter>(blankCharacter);

  const value = { sidebarCharacter, setSidebarCharacter };

  return (
    <SessionProvider>
      <SidebarContext.Provider value={value}>
        {children}
      </SidebarContext.Provider>
    </SessionProvider>
  );
};

export default Providers;
