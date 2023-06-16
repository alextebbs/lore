import { env } from "~/env.mjs";

export async function GET(request: Request) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: "Fantasy portrait of a dwarf with green eyes and blue hair",
      size: "256x256",
    }),
  });

  return response;
}
