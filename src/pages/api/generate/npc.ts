import { NextApiRequest, NextApiResponse } from "next";
import { NPC } from "~/utils/NPC";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { prompt } = req.query;

  const npc = new NPC({ originStatement: prompt as string });

  await npc.generateAll();

  res.status(200).json(npc);
}
