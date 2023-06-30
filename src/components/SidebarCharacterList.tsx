"use client";

import type { Character } from "@prisma/client";
import Link from "next/link";
import { useRouter, useSelectedLayoutSegments } from "next/navigation";
import { MdClose } from "react-icons/md";

interface SidebarCharacterListProps {
  userCharacters: Character[];
}

export const SidebarCharacterList: React.FC<SidebarCharacterListProps> = (
  props
) => {
  const { userCharacters } = props;

  const segments = useSelectedLayoutSegments();

  const currentCharacterID =
    segments[0] === "character" ? segments[1] : undefined;

  const router = useRouter();

  const handleDeleteCharacter = async (id: string) => {
    await fetch(`/api/character/delete?id=${id}`, { method: "DELETE" });

    if (currentCharacterID === id) router.push(`/`);
  };

  return (
    <>
      {userCharacters.map((character) => (
        <div key={character.id} className="group relative">
          <Link href={`/character/${character.id}`}>
            <div
              className={`border-b border-b-stone-900 p-4 font-heading text-2xl ${
                currentCharacterID == character.id
                  ? `bg-stone-900 text-stone-100`
                  : `text-stone-400 hover:text-red-600`
              } `}
            >
              {character.name || "Creating..."}

              <div className="font-body text-sm text-stone-600">
                {character.age || "??"} year old {character.species || "????"}
              </div>
            </div>
          </Link>
          <button
            onClick={() => handleDeleteCharacter(character.id)}
            className="absolute right-0 top-0 hidden p-2 text-xl text-stone-600 hover:text-red-600 group-hover:block"
          >
            <MdClose />
          </button>
        </div>
      ))}
    </>
  );
};
