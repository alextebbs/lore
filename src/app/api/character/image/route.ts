import { env } from "~/env.mjs";

interface DalleImageGenerationResponse {
  created: number;
  data: DalleImage[];
}

interface DalleImage {
  url: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const eyeColor = searchParams.get("eyeColor");
  const species = searchParams.get("species");
  const hairColor = searchParams.get("hairColor");

  if (!eyeColor || !species || !hairColor) {
    return new Response("Missing query params.", { status: 400 });
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: `Fantasy portrait of a ${species} with ${eyeColor} eyes and ${hairColor} hair. Epic fantasy art, sharp, award winning on Artstation, 4k HD.`,
      size: "256x256",
    }),
  });

  const json = (await response.json()) as DalleImageGenerationResponse;

  if (!json.data[0]?.url) {
    return new Response("Failed to generate", { status: 500 });
  }

  return new Response(
    JSON.stringify(json.data[0]?.url ?? "Failed to generate")
  );
}
