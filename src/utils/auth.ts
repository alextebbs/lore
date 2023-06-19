import { getServerSession, type NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import { db } from "~/utils/db";
import { env } from "~/env.mjs";
import { type Adapter } from "next-auth/adapters";

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

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as Adapter,
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
    session({ session, user }) {
      return {
        ...session,
        user: user,
      };
    },
  },
};

// This is just a helper so I only have to import one thing later instead of
// having to import the next-auth hook AND the options object.
export const getAuthSession = () => getServerSession(authOptions);
