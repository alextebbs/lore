"use client";

interface HeaderProps {
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

export const Header: React.FC<HeaderProps> = (props) => {
  const { setMenuOpen } = props;

  const user = useUser();

  return (
    <div className="flex items-center justify-center border-b border-b-stone-900 px-8 py-4 text-center uppercase text-stone-400">
      <div className="font-heading text-3xl">Mythweaver</div>
      <div className="ml-auto text-sm text-stone-400">
        {user.isSignedIn ? (
          <>
            <div onClick={(_) => setMenuOpen((prev) => !prev)}>Show Menu</div>
            <UserButton />
          </>
        ) : (
          <>
            <SignInButton>
              <button className="uppercase text-stone-300 hover:text-red-600">
                Sign in
              </button>
            </SignInButton>{" "}
            to save your stuff
          </>
        )}
      </div>
    </div>
  );
};
