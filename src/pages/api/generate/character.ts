import { type Character } from "@prisma/client";
import { type NextApiRequest, type NextApiResponse } from "next";

import { prisma } from "~/server/db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { prompt } = req.query;

  // First create the character in the database
  // This will give us an ID to use for the character
  const character = await prisma.character.create({
    data: {
      originStatement: prompt as string,
    },
  });

  res.status(200).json(character);

  const generateField = async (field: string, character: Character) => {
    const url = `http://${req.headers.host}/api/generate/character/${field}?id=${character.id}`;

    try {
      await fetch(url);
    } catch (err: unknown) {
      console.error(err);
    }
  };

  try {
    await generateField("baseInfo", character);
    await generateField("physicalDescription", character);
    await generateField("backstory", character);
  } catch (err: unknown) {
    console.error(err);
  }
}
