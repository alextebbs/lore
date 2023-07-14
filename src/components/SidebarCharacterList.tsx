"use client";

import type { Character } from "@prisma/client";
import Link from "next/link";
import { useRouter, useSelectedLayoutSegments } from "next/navigation";
import { MdClose } from "react-icons/md";
import { SidebarContext } from "./Providers";
import { Suspense, useContext } from "react";
import { cn } from "~/utils/cn";

interface SidebarCharacterListProps {
  userCharacters: Pick<Character, "age" | "name" | "species" | "id">[];
}

export const SidebarCharacterList: React.FC<SidebarCharacterListProps> = (
  props
) => {
  const { userCharacters } = props;

  const segments = useSelectedLayoutSegments();

  const routeID = segments[0] === "character" ? segments[1] : undefined;

  const router = useRouter();

  const { sidebarCharacter } = useContext(SidebarContext);

  const handleDeleteCharacter = async (id: string) => {
    await fetch(`/api/character/delete?id=${id}`, { method: "DELETE" });

    if (routeID === id) {
      router.push(`/`);
    } else {
      router.refresh();
    }
  };

  return (
    <>
      {userCharacters.map((character) => {
        const isCurrentCharacter = routeID === character.id;
        const contextCorrect =
          routeID === sidebarCharacter.id && isCurrentCharacter;

        return (
          <div key={character.id} className="group relative">
            <Link href={`/character/${character.id}`}>
              <div
                className={cn(
                  `border-b border-b-stone-900 p-4 font-heading text-2xl`,
                  isCurrentCharacter && `bg-stone-900 text-red-600`,
                  !isCurrentCharacter &&
                    `text-stone-200 hover:bg-stone-950 hover:text-red-600`
                )}
              >
                {contextCorrect ? (
                  <>
                    {sidebarCharacter.name || "..."}
                    <div className="font-body text-sm text-stone-600">
                      {sidebarCharacter.age || "??"} year old{" "}
                      {sidebarCharacter.species || "?????"}
                    </div>
                  </>
                ) : (
                  <>
                    {character.name || "..."}
                    <div className="font-body text-sm text-stone-600">
                      {character.age || "??"} year old{" "}
                      {character.species || "?????"}
                    </div>
                  </>
                )}
              </div>
            </Link>
            <button
              onClick={() => handleDeleteCharacter(character.id)}
              className="absolute right-0 top-0 hidden p-2 text-xl text-stone-600 hover:text-red-600 group-hover:block"
            >
              <MdClose />
            </button>
          </div>
        );
      })}
    </>
  );
};

// <div className={`border-b border-b-stone-900 p-4 font-heading text-2xl ${
//     isCurrentCharacter
//       ? `bg-stone-900 text-stone-100`
//       : `text-stone-400 hover:bg-stone-950 hover:text-red-600`
//   } `}
// >
//   {character.name || "Creating..."}

//   <div className="font-body text-sm text-stone-600">
//     {character.age || "??"} year old {character.species || "????"}
//   </div>
// </div>
