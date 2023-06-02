import type { NextPage } from "next";
import Head from "next/head";

import type { Character } from "@prisma/client";
import { PromptForm } from "~/components/PromptForm";
import router from "next/router";

const Home: NextPage = () => {
  const handleFormSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const elements = form.elements as typeof form.elements & {
      prompt: { value: string };
    };

    let url = "/api/generate/character";

    if (elements.prompt.value) {
      url += `?prompt=${elements.prompt.value}`;
    }

    try {
      const response = await fetch(url);
      const data = (await response.json()) as Character;
      await router.push(`/character/${data.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <Head>
        <title>Mythweaver</title>
        <meta name="description" content="Generated by create-t3-app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex min-h-[100vh] flex-col items-center justify-center">
        <div className="flex flex-grow flex-col items-center justify-center">
          <PromptForm handleFormSubmit={handleFormSubmit} />
        </div>
      </main>
    </>
  );
};

export default Home;