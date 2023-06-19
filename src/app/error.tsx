"use client"; // Error components must be Client Components

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h2 className="mb-2 font-heading text-xl lowercase tracking-[0.075em] text-stone-700">
        <span className="text-stone-600">{error.name}</span>
      </h2>
      <p className="mb-5 text-xs text-stone-700">Uh oh</p>
      <button className="inline-flex rounded bg-stone-900 px-4 py-2 text-xs uppercase tracking-[0.15em] text-stone-600 hover:bg-stone-800 hover:text-red-600">
        <Link href="/">Make a new character</Link>
      </button>
    </div>
  );
}
