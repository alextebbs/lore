import { type Character } from "@prisma/client";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { OPTIONS } from "~/app/api/auth/[...nextauth]/route";
import { getUserCharacters } from "~/utils/ServerSidePropsHelpers";
import { PromptForm } from "~/components/PromptForm";

export interface GlobalPageProps {
  userCharacters: Character[] | null;
}

// Yeah yeah yeah
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface PageProps extends GlobalPageProps {}

const Page = () => {
  return <PromptForm />;
};

export default Page;

export const getServerSideProps: GetServerSideProps<PageProps> = async (
  context
) => {
  const session = await getServerSession(context.req, context.res, OPTIONS);

  return {
    props: {
      userCharacters: session ? await getUserCharacters(session.user.id) : null,
    },
  };
};
