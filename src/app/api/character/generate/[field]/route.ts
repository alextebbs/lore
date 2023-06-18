import { getOpenAIResponse } from "~/utils/OpenAIWrapper";
import { PrismaClient } from "@prisma/client/edge";
import { type Character } from "~/utils/types";

import { PromptGenerator } from "~/utils/PromptGenerator";

export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: { field: keyof Character } }
) {
  const { searchParams } = new URL(request.url);

  const { field } = params;

  const prisma = new PrismaClient();

  let character = await prisma.character.findUnique({
    where: { id: searchParams.get("id") as string },
    include: {
      friends: true,
      enemies: true,
      goals: true,
    },
  });

  console.log(character?.goals);

  if (!character) {
    return new Response("Character not found.", { status: 404 });
  }

  // Depending on if this is a "regeneration" or not, we need to manipulate the
  // character a bit before sending it to the prompt generator
  if (searchParams.has("regenerate")) {
    // If we aren't trying to use the existing text in the regeneration, then we
    // need to null that field out. This is more complicated for relational items.
    if (!searchParams.has("useExistingData")) {
      if (searchParams.has("relationID")) {
        character = {
          ...character,
          [field]: (
            character[field] as Array<{ id: string; description: string }>
          )
            .map((item) => {
              return item.id === searchParams.get("relationID")
                ? { ...item, description: null }
                : item;
            })
            .filter((item) => item.description),
        };
      } else {
        character = { ...character, [field]: null };
      }
    } else {
      // If we ARE trying to use the existing data and we're trying to regenerate
      // a relational item, we only want to send that one item to the prompt generator
      if (searchParams.has("relationID")) {
        character = {
          ...character,
          [field]: (
            character[field] as Array<{ id: string; description: string }>
          ).filter((item) => item.id === searchParams.get("relationID")),
        };
      }
    }
  }

  const prompt = new PromptGenerator().generate(
    character,
    field,
    searchParams.get("prompt") ?? null
  );

  // console.log(`
  //   GENERATING ${field} ----------------------
  //   PROMPT: ${prompt}
  // `);

  const response = await getOpenAIResponse({
    prompt,
    stream: searchParams.has("stream"),
  });

  return new Response(response);
}
