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
          { description: "Friend 1 description" },
          { description: "Friend 2 description" },
          { description: "Friend 3 description" },
        ],
      },
      enemies: {
        create: [
          { description: "Enemy 1 description" },
          { description: "Enemy 2 description" },
          { description: "Enemy 3 description" },
        ],
      },
      goals: {
        create: [
          { description: "Goal 1 description" },
          { description: "Goal 2 description" },
          { description: "Goal 3 description" },
        ],
      },
    },
  });

  // Return empty shell character
  return new Response(JSON.stringify(character));
}
