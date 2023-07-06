import type { Character } from "@prisma/client";
import Link from "next/link";
import { GiScrollQuill } from "react-icons/gi";
import { SidebarCharacterList } from "./SidebarCharacterList";
import { getAuthSession } from "~/utils/auth";
import { db } from "~/utils/db";
import { SignIn } from "./SignIn";

export const Sidebar = async () => {
  const session = await getAuthSession();

  let userCharacters:
    | Pick<Character, "age" | "name" | "species" | "id">[]
    | undefined = undefined;

  if (session?.user) {
    try {
      userCharacters = await db.character.findMany({
        orderBy: [{ createdAt: "desc" }],
        where: { userId: session.user.id },
        select: { age: true, name: true, species: true, id: true },
      });
    } catch (error: unknown) {
      console.error(error);
    }
  }

  return (
    <>
      <div>
        <Link href={`/`}>
          <div className="flex border-b border-stone-900 p-4 font-heading text-3xl lowercase text-stone-600 hover:text-red-600">
            Mythroller
          </div>
        </Link>

        <Link href={`/`}>
          <div
            className={`flex border-b border-b-stone-900 p-4 text-sm uppercase tracking-[0.15em] text-stone-300 hover:bg-stone-950 hover:text-red-600`}
          >
            <GiScrollQuill className="mr-3 text-xl" /> New character
          </div>
        </Link>
      </div>

      <div className="flex-grow overflow-auto">
        {userCharacters ? (
          <div>
            <SidebarCharacterList userCharacters={userCharacters} />
          </div>
        ) : (
          <SignIn />
        )}
      </div>
    </>
  );
};
