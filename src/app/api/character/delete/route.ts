import { PrismaClient } from "@prisma/client/edge";

import { getServerSession } from "next-auth/next";
import { OPTIONS } from "~/app/api/auth/[...nextauth]/route";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const prisma = new PrismaClient();

  const session = await getServerSession(OPTIONS);

  console.time("delete");
  // QUESTION: I really only want to delete one character here. I'm using
  // deleteMany because the regular delete will only let me find characters by
  // their id, not their id and their userId. Is there a better way to do this?
  const response = await prisma.character.deleteMany({
    where: {
      id: searchParams.get("id") as string,
      userId: session?.user.id,
    },
  });
  console.timeEnd("delete");

  return new Response(JSON.stringify(response));
}
