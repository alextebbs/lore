import { PrismaClient } from "@prisma/client/edge";
import { CharacterSheet } from "~/components/CharacterSheet";
import { type Character } from "@prisma/client";

export default async function Page({ params }: { params: { id: string } }) {
  const { id } = params;

  const prisma = new PrismaClient();

  const getCharacter = async (id: string) => {
    try {
      const character: Character | null = await prisma.character.findUnique({
        where: { id },
      });

      return character;
    } catch (error: unknown) {
      console.error(error);
      return null;
    }
  };

  const character: Character | null = await getCharacter(id);

  if (!character) {
    // Render an error message or redirect if character is null
    return <div>Character {params.id} not found.</div>;
  }

  return <CharacterSheet character={character} />;
}
