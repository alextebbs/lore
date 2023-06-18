import { PrismaClient } from "@prisma/client/edge";

import { getServerSession } from "next-auth/next";
import { OPTIONS } from "~/app/api/auth/[...nextauth]/route";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const prisma = new PrismaClient();

  const session = await getServerSession(OPTIONS);

  console.time("reroll");

  const response = await prisma.character.update({
    where: {
      id: searchParams.get("id") as string,
      // userId: session?.user.id,
    },
    data: {
      name: null,
      age: null,
      species: null,
      height: null,
      weight: null,
      eyeColor: null,
      hairColor: null,
      backstory: null,
      physicalDescription: null,
      demeanor: null,
      secret: null,
      roleplayTips: null,
      imageURL: null,
      goals: {
        updateMany: {
          where: {
            description: { not: null },
          },
          data: {
            description: null,
          },
        },
      },
    },
    include: {
      friends: true,
      enemies: true,
      goals: true,
    },
  });
  console.timeEnd("reroll");

  return new Response(JSON.stringify(response));
}
