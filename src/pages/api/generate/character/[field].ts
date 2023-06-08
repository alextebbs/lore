import { getOpenAIResponse } from "~/utils/OpenAIWrapper";
import { type Character, PrismaClient } from "@prisma/client/edge";

import { PromptGenerator } from "~/utils/PromptGenerator";

export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: { field: keyof Character } }
) {
  const { searchParams } = new URL(request.url);

  const prisma = new PrismaClient();

  const character = await prisma.character.findUnique({
    where: { id: searchParams.get("id") as string },
  });

  if (!character) {
    return new Response("Character not found.", { status: 404 });
  }

  const prompt = new PromptGenerator().generate(
    character,
    params.field,
    searchParams.has("regenerate"),
    searchParams.has("prompt") ? searchParams.get("prompt") : null
  );

  const response = await getOpenAIResponse({
    prompt,
    stream: searchParams.has("stream"),
  });

  return new Response(response);
}
