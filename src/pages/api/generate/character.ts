import { type NextApiRequest, type NextApiResponse } from "next";

import { prisma } from "~/server/db";

// const generateFields = async (field:string, character:Character) => {

// }

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
}
