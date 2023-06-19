import { notFound } from "next/navigation";
import { db } from "src/utils/db";
import { CharacterSheet } from "~/components/CharacterSheet";

interface PageProps {
  params: {
    id: string;
  };
}

const page = async ({ params }: PageProps) => {
  const { id } = params;

  const character = await db.character.findUnique({
    where: { id },
    include: {
      friends: true,
      enemies: true,
      goals: true,
    },
  });

  if (!character) return notFound();

  return <CharacterSheet character={character} />;
};

export default page;
