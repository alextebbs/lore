import { type Character } from "~/utils/types";

import { db } from "~/utils/db";

export const getUserCharacters = async (userId: string) => {
  try {
    const characters = await db.character.findMany({
      where: { userId },
    });
    return JSON.parse(JSON.stringify(characters)) as Character[];
  } catch (error: unknown) {
    console.error(error);
    return null;
  }
};

export const getSingleCharacter = async (id: string) => {
  try {
    const character = await db.character.findUnique({
      where: { id },
      include: {
        friends: true,
        enemies: true,
        goals: true,
      },
    });

    return JSON.parse(JSON.stringify(character)) as Character;
  } catch (error: unknown) {
    console.error(error);
    return null;
  }
};
