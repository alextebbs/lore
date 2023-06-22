// This file caches prisma for local development and has some database util
// functions.

import { PrismaClient } from "@prisma/client/edge";
import "server-only";
import { getAuthSession } from "./auth";

declare global {
  // eslint-disable-next-line no-var, no-unused-vars
  var cachedPrisma: PrismaClient;
}

let prisma: PrismaClient;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.cachedPrisma) {
    global.cachedPrisma = new PrismaClient();
  }

  prisma = global.cachedPrisma;
}

export const db = prisma;

export async function verifyCurrentUserHasAccessToItem(itemId: string) {
  const session = await getAuthSession();

  const count = await db.character.count({
    where: {
      id: itemId,
      userId: session?.user.id,
    },
  });

  return count > 0;
}
