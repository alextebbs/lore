import { type GetServerSideProps } from "next";

interface PageProps {
  id: string;
}

export default function Page(props: PageProps) {
  const { id } = props;

  // Render an error message or redirect if character is null
  return <div>{id}</div>;
}

export const getServerSideProps: GetServerSideProps<PageProps> = async (
  context
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  const { id } = context.query;

  return {
    props: { id: id as string },
  };
};
