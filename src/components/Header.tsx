"use client";

import { useSession, signIn } from "next-auth/react";

interface HeaderProps {
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const Header: React.FC<HeaderProps> = (props) => {
  const { setMenuOpen } = props;

  const { data: session } = useSession();

  return (
    <div className="flex items-center justify-center border-b border-b-stone-900 px-8 py-4 text-center uppercase text-stone-400">
      <div className="font-heading text-3xl">Mythweaver</div>
      <div className="ml-auto text-sm text-stone-400">
        {session ? (
          <>
            <div onClick={(_) => setMenuOpen((prev) => !prev)}>Show Menu</div>
          </>
        ) : (
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
    </div>
  );
};
