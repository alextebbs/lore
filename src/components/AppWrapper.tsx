"use client";

import { type ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useState } from "react";
import type { Character } from "@prisma/client";

interface AppWrapperProps {
  children: ReactNode;
  userCharacters?: Character[] | null;
  character?: Character | null;
}

const AppWrapper: React.FC<AppWrapperProps> = (props) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const { children } = props;

  return (
    <div className="flex h-screen flex-col">
      <Header setMenuOpen={setMenuOpen} />
      <div className="flex flex-grow">
        <div className="flex flex-grow items-center justify-center">
          {children}
        </div>
        <Sidebar
          menuOpen={menuOpen}
          characters={props.userCharacters}
          currentCharacter={props.character}
        />
      </div>
    </div>
  );
};

export default AppWrapper;
