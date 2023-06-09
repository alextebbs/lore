import { PrismaClient } from "@prisma/client/edge";

import { getServerSession } from "next-auth/next";
import { OPTIONS } from "~/app/api/auth/[...nextauth]/route";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const session = await getServerSession(OPTIONS);

  console.log(session);

  const prisma = new PrismaClient();

  const prompt = searchParams.get("prompt");

  // Create character in DB as an empty shell character
  const character = await prisma.character.create({
    data: {
      originStatement: prompt as string,
      userId: session?.user?.id as string,
    },
  });

  // Return empty shell character
  return new Response(JSON.stringify(character));
}
