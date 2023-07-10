import { env } from "~/env.mjs";
import { v2 as cloudinary } from "cloudinary";

interface DalleImageGenerationResponse {
  created: number;
  data: DalleImage[];
}

interface DalleImage {
  url: string;
}

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

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

  const result = await cloudinary.uploader.upload(json.data[0].url);

  return new Response(
    JSON.stringify(result.secure_url ?? "Failed to generate")
  );
}
