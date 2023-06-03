import { PrismaClient } from "@prisma/client/edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const prisma = new PrismaClient();

  const prompt = searchParams.get("prompt");

  // Create character in DB as an empty shell character
  const character = await prisma.character.create({
    data: {
      originStatement: prompt as string,
    },
  });

  // Return empty shell character
  return new Response(JSON.stringify(character));
}
