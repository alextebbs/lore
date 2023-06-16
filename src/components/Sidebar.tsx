import type { Character } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { signIn } from "next-auth/react";
import { MdClose } from "react-icons/md";

interface SidebarProps {
  characters?: Character[] | null;
  currentCharacter?: Character | null;
  menuOpen?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = (props) => {
  const { characters, currentCharacter } = props;

  const router = useRouter();

  const handleDeleteCharacter = async (id: string) => {
    await fetch(`/api/character/delete?id=${id}`);
    router.push(`/`);
  };

  return (
    <div className="fixed flex h-screen -translate-x-full flex-col overflow-auto border-r border-stone-800 lg:static lg:w-80 lg:translate-x-0">
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
              <div key={character.id} className="group relative">
                <Link href={`/character/${character.id}`}>
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
