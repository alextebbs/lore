import { type Character } from "~/utils/types";
import { type GetServerSideProps } from "next";
import { CharacterSheet } from "~/components/CharacterSheet";
import type { GlobalPageProps } from "..";
import { getServerSession } from "next-auth";
import { OPTIONS } from "~/app/api/auth/[...nextauth]/route";
import {
  getSingleCharacter,
  getUserCharacters,
} from "~/utils/ServerSidePropsHelpers";

interface PageProps extends GlobalPageProps {
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
) => {
  const { id } = context.query;

  console.log(id);

  const session = await getServerSession(context.req, context.res, OPTIONS);

  return {
    props: {
      userCharacters: session ? await getUserCharacters(session.user.id) : null,
      character: await getSingleCharacter(id as string),
    },
  };
};
