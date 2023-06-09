import { type NextApiHandler } from "next";
import NextAuth, { type NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import { PrismaClient } from "@prisma/client";

import { env } from "~/env.mjs";
import { type Adapter } from "next-auth/adapters";

const prisma = new PrismaClient();

// QUESTION: Why do I have to cast Adapter and NextAPIHandler to their types?

export const OPTIONS: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_ID,
      clientSecret: env.GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    session: async ({ session, user }) => {
      return {
        ...session,
        user: user,
      };
    },
  },
};

const handler = NextAuth(OPTIONS) as NextApiHandler;

export { handler as GET, handler as POST };
