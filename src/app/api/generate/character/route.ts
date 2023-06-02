import { prisma } from "~/server/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

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
