import type { Character } from "@prisma/client";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { GiScrollQuill } from "react-icons/gi";
import { BsGoogle } from "react-icons/bs";
import { SidebarCharacterList } from "./SidebarCharacterList";
import { getAuthSession } from "~/utils/auth";
import { db } from "~/utils/db";

export const Sidebar = async () => {
  const session = await getAuthSession();

  let userCharacters: Character[] | null = null;

  if (session?.user) {
    try {
      userCharacters = await db.character.findMany({
        orderBy: [{ createdAt: "desc" }],
        where: { userId: session.user.id },
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

      <div className="flex-grow overflow-auto">
        {userCharacters ? (
          <div>
            <SidebarCharacterList userCharacters={userCharacters} />
          </div>
        ) : (
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
    </>
  );
};
