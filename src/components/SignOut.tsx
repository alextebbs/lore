"use client";

import { signOut } from "next-auth/react";
import { BiLogOut } from "react-icons/bi";

export const SignOut = () => {
  return (
    <button
      onClick={() => signOut()}
      className="flex uppercase tracking-[0.15em] hover:text-red-600"
    >
      <BiLogOut className="relative top-0.5 mr-2 text-sm" />
      Logout
    </button>
  );
};
