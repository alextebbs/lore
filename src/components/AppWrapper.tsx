"use client";

import { type ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useState } from "react";
import type { Character } from "~/utils/types";

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
        <Sidebar
          menuOpen={menuOpen}
          characters={props.userCharacters}
          currentCharacter={props.character}
        />
        <div className="flex flex-grow justify-center bg-stone-950">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AppWrapper;
