import type { Character } from "@prisma/client";
import Link from "next/link";

interface SidebarProps {
  characters?: Character[] | null;
  menuOpen?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = (props) => {
  const { characters } = props;

  return (
    <div className="w-80 border-l border-l-stone-900">
      <div className="p-4 text-xs uppercase tracking-[0.25em] text-stone-600">
        Your characters
      </div>
      {characters?.map((character) => (
        <Link key={character.id} href={`/character/${character.id}`}>
          <div className="border-b border-b-stone-900 p-4 font-heading text-2xl hover:text-red-600">
            {character.name || "Unnamed character"}
          </div>
        </Link>
      ))}
    </div>
  );
};
