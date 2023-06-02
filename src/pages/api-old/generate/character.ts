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

  // Then, return a response
  res.status(200).json(character);

  // Then, generate more fields behind the scenes
  const generateField = async (field: string, character: Character) => {
    const url = `http://${
      req.headers.host as string
    }/api/generate/character/${field}?id=${character.id}`;

    try {
      await fetch(url);
    } catch (err: unknown) {
      console.error(err);
    }
  };

  try {
    await generateField("baseInfo", character);
    await generateField("physicalDescription", character);
    await generateField("physicalSpecs", character);
    await generateField("backstory", character);
    await generateField("goals", character);
  } catch (err: unknown) {
    console.error(err);
  }
}
