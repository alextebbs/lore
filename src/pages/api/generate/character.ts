import { type NextApiRequest, type NextApiResponse } from "next";
import { Character } from "~/utils/Character";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { prompt } = req.query;

  const character = new Character({ originStatement: prompt as string });

  await character.generateAll();

  res.status(200).json(character);
}
