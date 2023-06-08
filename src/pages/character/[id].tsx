import { PrismaClient } from "@prisma/client/edge";
import { type Character } from "@prisma/client";
import { type GetServerSideProps } from "next";
import { CharacterSheet } from "~/components/CharacterSheet";

interface PageProps {
  character: Character | null;
}

export default function Page(props: PageProps) {
  const { character } = props;

  if (!character) {
    // Render an error message or redirect if character is null
    return <div>Character not found.</div>;
  }

  return <CharacterSheet character={character} />;
}

export const getServerSideProps: GetServerSideProps<PageProps> = async (
  context
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  const { id } = context.query;

  const prisma = new PrismaClient();

  try {
    const character = await prisma.character.findUnique({
      where: { id: id as string },
    });

    return {
      props: { character: JSON.parse(JSON.stringify(character)) as Character },
    };
  } catch (error: unknown) {
    console.error(error);
    return { props: { character: null } };
  }
};
