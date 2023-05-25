import { prisma } from "~/server/db";
import { CharacterSheet } from "~/components/CharacterSheet";
import { type Character } from "@prisma/client";
import { GetServerSideProps, NextPage } from "next";

interface PageProps {
  character: Character | null;
}

export default function Page(props: PageProps) {
  const { character } = props;

  if (!character) {
    // Render an error message or redirect if character is null
    return <div>Character ID not found.</div>;
  }

  return <CharacterSheet character={character} />;
}

export const getServerSideProps: GetServerSideProps<PageProps> = async (
  context
) => {
  const { id } = context.query;

  try {
    const character = await prisma.character.findUnique({
      where: { id: id as string },
    });

    return { props: { character: JSON.parse(JSON.stringify(character)) } };
  } catch (error) {
    console.error(error);
    return { props: { character: null } };
  }
};
