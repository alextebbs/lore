import { type NextApiHandler } from "next";
import NextAuth, { type NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import { PrismaClient } from "@prisma/client";

import { env } from "~/env.mjs";

const prisma = new PrismaClient();

export const OPTIONS: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_ID,
      clientSecret: env.GOOGLE_SECRET,
    }),
  ],
};

const handler = NextAuth(OPTIONS) as NextApiHandler;

export { handler as GET, handler as POST };
