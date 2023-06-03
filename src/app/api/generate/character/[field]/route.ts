import { OpenAIStream, type OpenAIStreamPayload } from "~/utils/OpenAIStream";
import { PrismaClient } from "@prisma/client/edge";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const prisma = new PrismaClient();

  const id = searchParams.get("id");

  const character = await prisma.character.findUnique({
    where: { id: id as string },
  });

  if (!character) {
    return new Response("Character not found.", { status: 404 });
  }

  const payload: OpenAIStreamPayload = {
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "user",
        content: `Generate a fantasy character that is ${
          character.originStatement || "really cool"
        }`,
      },
    ],
    temperature: 1,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 2048,
    stream: true,
    n: 1,
  };

  const stream = await OpenAIStream(payload);
  return new Response(stream);
}
