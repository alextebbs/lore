import { type NextApiRequest, type NextApiResponse } from "next";
import { CharacterClass } from "~/utils/Character";

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

  // Then create a CharacterClass instance
  const characterClass = new CharacterClass(character);

  // Then generate the base info
  await characterClass.generateAll();

  // Then update the character in the database
  await prisma.character.update({
    where: {
      id: characterClass.id,
    },
    data: characterClass,
  });

  res.status(200).json(characterClass);
}
