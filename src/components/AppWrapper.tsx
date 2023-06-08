"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { type ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useState } from "react";

interface AppWrapperProps {
  children: ReactNode;
}

const AppWrapper: React.FC<AppWrapperProps> = ({ children }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <ClerkProvider>
      <div className="flex h-screen flex-col">
        <Header setMenuOpen={setMenuOpen} />
        <div className="flex flex-grow">
          <div className="flex flex-grow items-center justify-center">
            {children}
          </div>
          <Sidebar menuOpen={menuOpen} />
        </div>
      </div>
    </ClerkProvider>
  );
};

export default AppWrapper;
