import { type NextApiRequest, type NextApiResponse } from "next";

import { prisma } from "~/server/db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { prompt } = req.query;

  // First create the character in the database
  // This will give us an ID to use for the character
  let character = await prisma.character.create({
    data: {
      originStatement: prompt as string,
    },
  });

  // Then create a CharacterClass instance
  // const generator = new CharacterGenerator();

  // Then generate the base info
  // character = await generator.generateAll(character);

  // Then update the character in the database
  await prisma.character.update({
    where: {
      id: character.id,
    },
    data: character,
  });

  res.status(200).json(character);
}
