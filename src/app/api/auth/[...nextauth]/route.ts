import { type NextApiHandler } from "next";
import NextAuth, { type NextAuthOptions, type User } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import { PrismaClient } from "@prisma/client";

import { env } from "~/env.mjs";
import { type Adapter } from "next-auth/adapters";

const prisma = new PrismaClient();

// QUESTION:
// is this the right thing to do here? I think I need to extend the User and
// Session types from next-auth. Is this a regular thing to do?
declare module "next-auth" {
  interface User {
    id: string;
  }

  interface Session {
    user: User;
  }
}

export const OPTIONS: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_ID,
      clientSecret: env.GOOGLE_SECRET,
    }),
  ],

  // This is the default
  // session: {
  //   strategy: "jwt",
  // },

  callbacks: {
    // QUESTION:
    // I don't know where this is supposed to be awaited?
    // eslint-disable-next-line @typescript-eslint/require-await
    async session({ session, user }) {
      return {
        ...session,
        user: user,
      };
    },
  },
};

const handler = NextAuth(OPTIONS) as NextApiHandler;

export { handler as GET, handler as POST };
