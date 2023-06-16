import type { Character } from "@prisma/client";
import Link from "next/link";

import { signIn } from "next-auth/react";

interface SidebarProps {
  characters?: Character[] | null;
  currentCharacter?: Character | null;
  menuOpen?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = (props) => {
  const { characters, currentCharacter } = props;

  return (
    <div className="flex h-screen w-80 flex-col overflow-auto border-r border-stone-800">
      <Link href={`/`}>
        <div className="border-b border-stone-900 p-4 font-heading text-3xl uppercase tracking-[0.05em] text-stone-600 hover:text-red-600">
          Mythweaver
        </div>
      </Link>

      <div className="flex-grow">
        {characters && (
          <>
            <Link href={`/`}>
              <div
                className={`border-b border-b-stone-900 p-4 font-body text-sm uppercase tracking-[0.15em] text-red-600 hover:bg-stone-900`}
              >
                + New character
              </div>
            </Link>
            {characters?.map((character) => (
              <Link key={character.id} href={`/character/${character.id}`}>
                <div
                  className={`border-b border-b-stone-900 p-4 font-heading text-2xl ${
                    currentCharacter?.id == character.id
                      ? `bg-stone-900 text-stone-100`
                      : `text-stone-400 hover:text-red-600`
                  } `}
                >
                  {character.name || "Unnamed character"}

                  {character.age && character.species && (
                    <div className="font-body text-sm text-stone-600">
                      {character.age} year old {character.species}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </>
        )}
        {!characters && (
          <>
            <div className="flex h-[100%] items-center justify-center p-4 text-center text-sm uppercase">
              <button
                onClick={() => signIn()}
                className="uppercase text-stone-300 hover:text-red-600"
              >
                <span className="text-red-600">Sign in</span> to save your stuff
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
