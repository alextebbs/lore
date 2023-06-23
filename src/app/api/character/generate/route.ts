import { db } from "~/utils/db";
import { getAuthSession } from "~/utils/auth";
import { cookies } from "next/headers";
import { nanoid } from "nanoid";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const session = await getAuthSession();

  const prompt = searchParams.get("prompt");

  const cookieId = nanoid();

  if (!cookies().get("lore.cookie")) {
    cookies().set({ name: "lore-cookie", value: cookieId });
  }

  // Create character in DB as an empty shell character
  const character = await db.character.create({
    data: {
      originStatement: prompt,
      userId: session?.user.id,
      cookieId,
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
