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

  if (!id) {
    // Render an error message or redirect if character is null
    // QUESTION: Should this actually give a 404?
    return (
      <div className="flex h-screen items-center justify-center text-xs uppercase tracking-[0.15em]">
        Character not found
      </div>
    );
  }

  return <CharacterSheet character={character} />;
};

export default page;
