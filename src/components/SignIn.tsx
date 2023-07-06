"use client";

import { signIn } from "next-auth/react";
import { BsGoogle } from "react-icons/bs";

export const SignIn = () => {
  return (
    <div className="flex h-[100%] items-center justify-center p-4 text-center text-sm uppercase">
      <button
        onClick={() => signIn("google")}
        className="flex flex-col items-center text-center uppercase text-stone-300 hover:text-red-600"
      >
        <div className="mb-2 flex items-center text-red-600">
          <BsGoogle className="mr-2" /> Sign in
        </div>
        <div className="text-xs">to save and edit</div>
      </button>
    </div>
  );
};
