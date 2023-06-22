import { db } from "~/utils/db";
import { getAuthSession } from "~/utils/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const session = await getAuthSession();

  console.log(session);

  const prompt = searchParams.get("prompt");

  // Create character in DB as an empty shell character
  const character = await db.character.create({
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
