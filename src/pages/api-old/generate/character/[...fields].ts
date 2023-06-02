import { type NextApiRequest, type NextApiResponse } from "next";
import { prisma } from "~/server/db";
import { type Character } from "@prisma/client";
import { CharacterGenerator } from "~/server/CharacterGenerator";
import { pusherServer as pusher } from "~/utils/pusher";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { _prompt, id, fields } = req.query;

  try {
    // queries the DB for a character with a certain ID
    let character: Character | null = await prisma.character.findUnique({
      where: { id: id as string },
    });

    if (character == null) {
      throw new Error("Character ID not found.");
    }

    // Decides whether this is a new generation or not
    if (!character.finishedGeneration) {
      const generator = new CharacterGenerator();

      for (const field of fields as string[]) {
        character = await generator.generate(character, field);
      }
    } else {
      throw new Error("Regeneration not yet implemented.");
    }

    // updates the character in the DB with the new info
    await prisma.character.update({
      where: {
        id: character.id,
      },
      data: character,
    });

    await pusher.trigger("character", character.id, { character });

    // returns the character to the client
    res.status(200).json(character);
  } catch (err: unknown) {
    if (err instanceof Error) {
      res.status(500).json({ error: err.message });
    }
  }
}
