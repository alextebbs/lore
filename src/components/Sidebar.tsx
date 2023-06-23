"use client";

import type { Character } from "@prisma/client";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSelectedLayoutSegments } from "next/navigation";
import { GiScrollQuill } from "react-icons/gi";
import { BsGoogle } from "react-icons/bs";
import { MdClose } from "react-icons/md";

interface SidebarProps {
  userCharacters?: Character[] | null;
}

export const Sidebar: React.FC<SidebarProps> = (props) => {
  const { userCharacters } = props;

  const segments = useSelectedLayoutSegments();

  const currentCharacterID =
    segments[0] === "character" ? segments[1] : undefined;

  const router = useRouter();

  const handleDeleteCharacter = async (id: string) => {
    await fetch(`/api/character/delete?id=${id}`, { method: "DELETE" });

    if (currentCharacterID === id) {
      router.push(`/`);
    } else {
      router.refresh();
    }
  };

  return (
    <div className="relative flex h-screen -translate-x-full flex-col overflow-auto border-r border-stone-800 bg-black lg:static lg:w-72 lg:translate-x-0">
      <div className="sticky top-0 z-10 bg-black">
        <Link href={`/`}>
          <div className="flex border-b border-stone-900 p-4 font-heading text-3xl lowercase text-stone-600 hover:text-red-600">
            Mythweaver
          </div>
        </Link>

        <Link href={`/`}>
          <div
            className={`flex border-b border-b-stone-900 p-4 text-sm uppercase tracking-[0.15em] text-red-600 hover:bg-stone-900`}
          >
            <GiScrollQuill className="mr-3 text-xl" /> New character
          </div>
        </Link>
      </div>

      <div className="flex-grow">
        {userCharacters && (
          <>
            {userCharacters?.map((character) => (
              <div key={character.id} className="group relative">
                <Link href={`/character/${character.id}`}>
                  <div
                    className={`border-b border-b-stone-900 p-4 font-heading text-2xl ${
                      currentCharacterID == character.id
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
                <button
                  onClick={() => handleDeleteCharacter(character.id)}
                  className="absolute right-0 top-0 hidden p-2 text-xl text-stone-600 hover:text-red-600 group-hover:block"
                >
                  <MdClose />
                </button>
              </div>
            ))}
          </>
        )}
        {!userCharacters && (
          <>
            <div className="flex h-[100%] items-center justify-center p-4 text-center text-sm uppercase">
              <button
                onClick={() => signIn("google")}
                className="flex flex-col items-center text-center uppercase text-stone-300 hover:text-red-600"
              >
                <div className="mb-2 flex items-center text-red-600">
                  <BsGoogle className="mr-2" /> Sign in
                </div>
                <div className="text-xs">to save your stuff</div>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
