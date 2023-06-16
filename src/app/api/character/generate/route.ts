import { PrismaClient } from "@prisma/client/edge";

import { getServerSession } from "next-auth/next";
import { OPTIONS } from "~/app/api/auth/[...nextauth]/route";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const session = await getServerSession(OPTIONS);

  const prisma = new PrismaClient();

  const prompt = searchParams.get("prompt");

  // Create character in DB as an empty shell character
  const character = await prisma.character.create({
    data: {
      originStatement: prompt,
      userId: session?.user.id,
      friends: {
        create: [
          { description: null },
          { description: null },
          { description: null },
        ],
      },
      enemies: {
        create: [
          { description: null },
          { description: null },
          { description: null },
        ],
      },
      goals: {
        create: [
          { description: null },
          { description: null },
          { description: null },
        ],
      },
    },
  });

  // Return empty shell character
  return new Response(JSON.stringify(character));
}
