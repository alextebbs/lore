import type { Character } from "@prisma/client";
import Link from "next/link";

interface SidebarProps {
  characters?: Character[] | null;
  currentCharacter?: Character | null;
  menuOpen?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = (props) => {
  const { characters, currentCharacter } = props;

  return (
    <div className="w-80 border-l border-l-stone-900">
      <div className="border-b border-stone-900 p-4 font-heading text-3xl uppercase">
        Mythweaver
      </div>
      {characters && (
        <>
          <Link href={`/`}>
            <div
              className={`border-b border-b-stone-900 p-4 font-body text-sm uppercase text-red-600 hover:bg-stone-900`}
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
          <button
            onClick={() => signIn()}
            className="uppercase text-stone-300 hover:text-red-600"
          >
            Sign in
          </button>{" "}
          to save your stuff
        </>
      )}
    </div>
  );
};
