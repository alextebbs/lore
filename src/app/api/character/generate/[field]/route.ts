import { type Character } from "~/utils/types";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { PromptGenerator } from "~/utils/PromptGenerator";
import { openai } from "~/utils/ai";

export const runtime = "edge";

export async function POST(
  request: Request,
  { params }: { params: { field: keyof Character } }
) {
  const { searchParams } = new URL(request.url);

  const { field } = params;

  let character = (await request.json()) as Character;

  if (!character) {
    return new Response("No character provided.", { status: 400 });
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

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      stream: true,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 2048,
      temperature: 1,
      top_p: 1,
      frequency_penalty: 1,
      presence_penalty: 1,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const stream = OpenAIStream(response);

    return new StreamingTextResponse(stream);
  } catch (err: unknown) {
    console.error(err);
    return new Response("Could not generate field", { status: 500 });
  }
}
