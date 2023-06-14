import type { Character } from "~/utils/types";
import arrayShuffle from "array-shuffle";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export const PromptForm: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const contentEditableRef = useRef<HTMLSpanElement>(null);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [examples, setExamples] = useState<string[]>([
    "the wayward heir of a tyrant queen",
    "the last of a long line of sorcerers",
    "the inventor of arcane magic",
    "a devout worshipper of a forgotten god",
    "a former slave of a powerful warlord",
  ]);

  useEffect(() => {
    setExamples(arrayShuffle(examples).slice(2));
    // Eslint wants me to add `examples` to the dependency array, but that
    // makes this not work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExampleClick = (example: string) => {
    const input = inputRef.current as HTMLInputElement;
    input.value = example;

    const contentEditable = contentEditableRef.current as HTMLSpanElement;
    contentEditable.innerText = example;
  };

  const handleFormSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    setIsLoading(true);

    const form = e.target as HTMLFormElement;
    const elements = form.elements as typeof form.elements & {
      prompt: { value: string };
    };

    let url = `/api/generate/character`;

    if (elements.prompt.value) {
      url += `?prompt=${elements.prompt.value}`;
    }

    try {
      const response = await fetch(url);
      const character = (await response.json()) as Character;
      router.push(`/character/${character.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePromptInput = (e: React.SyntheticEvent<HTMLSpanElement>) => {
    const span = e.target as HTMLSpanElement;
    const input = inputRef.current as HTMLInputElement;
    input.value = span.innerText;
  };

  return (
    <main className="flex flex-col items-center justify-center">
      <div className="flex flex-grow flex-col items-center justify-center">
        <form
          className="mx-auto max-w-[50rem] p-4 text-center"
          onSubmit={handleFormSubmit}
        >
          {!isLoading ? (
            <>
              <p className="mb-2 text-sm">
                Complete the sentence below to generate a character.
              </p>

              <p className="text-xs text-stone-400">
                Or, leave it empty to generate a random character.
              </p>

              <div className="my-8 font-heading text-3xl">
                The character is{" "}
                <span
                  contentEditable
                  ref={contentEditableRef}
                  onInput={handlePromptInput}
                  className="inline-block min-w-[200px] border-b text-left focus:outline-none"
                ></span>
                .
              </div>
              <div>
                <button
                  className="border border-red-600 p-4 px-8 font-heading text-lg text-red-600 transition-colors hover:bg-red-600 hover:text-white"
                  type="submit"
                >
                  Generate
                </button>
              </div>
              <input ref={inputRef} type="hidden" name="prompt" />

              <p className="mt-12 text-xs text-stone-400">For example...</p>

              <ul className="mt-2 text-xs text-stone-400">
                {examples.map((example) => (
                  <li
                    key={example}
                    className="mb-2 cursor-pointer hover:text-stone-600"
                    onClick={() => handleExampleClick(example)}
                  >
                    &ldquo;<span>The character is {example}.</span>&rdquo;
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div>Loading...</div>
          )}
        </form>
      </div>
    </main>
  );
};
