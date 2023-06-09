import { PrismaClient, type Character } from "@prisma/client";

const prisma = new PrismaClient();

export const getUserCharacters = async (userId: string) => {
  try {
    const characters = await prisma.character.findMany({
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
    const character = await prisma.character.findUnique({
      where: { id },
    });

    return JSON.parse(JSON.stringify(character)) as Character;
  } catch (error: unknown) {
    console.error(error);
    return null;
  }
};
