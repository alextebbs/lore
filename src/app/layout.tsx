import type { Character } from "@prisma/client";
import { IBM_Plex_Mono } from "next/font/google";
import Providers from "~/components/Providers";
import { Sidebar } from "~/components/Sidebar";
import { getAuthSession } from "~/utils/auth";
import { cn } from "~/utils/cn";
import { db } from "~/utils/db";

import "~/styles/globals.css";

const plex = IBM_Plex_Mono({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-plex",
});

export const metadata = {
  title: "Mythweaver",
  description: "Generate character's for TTRPG's",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();

  // QUESTION: Sort of unsure why this renders so much. Not sure if I'm doing
  // something wrong or if thats how it's meant to work.
  // console.log("RENDERING");

  let userCharacters: Character[] | null = null;

  if (session?.user) {
    try {
      userCharacters = await db.character.findMany({
        where: { userId: session.user.id },
      });
    } catch (error: unknown) {
      console.error(error);
    }
  }

  return (
    <html lang="en">
      <body className={cn(plex.className)}>
        <Providers>
          <div className="flex min-h-screen flex-grow">
            <Sidebar userCharacters={userCharacters} />

            <div className="relative flex h-screen flex-grow justify-center overflow-auto bg-stone-950">
              {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
