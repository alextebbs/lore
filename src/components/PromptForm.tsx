import { type FormEventHandler } from "react";
import { useRef, useState, useEffect } from "react";
import arrayShuffle from "array-shuffle";

interface PromptFormProps {
  handleFormSubmit: FormEventHandler<HTMLFormElement>;
}

export const PromptForm: React.FC<PromptFormProps> = (props) => {
  const { handleFormSubmit } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const contentEditableRef = useRef<HTMLSpanElement>(null);

  const [examples, setExamples] = useState<string[]>([
    "the wayward heir of a tyrant queen",
    "the last of a long line of sorcerers",
    "the inventor of arcane magic",
    "a devout worshipper of a forgotten god",
    "a former slave of a powerful warlord",
  ]);

  useEffect(() => {
    setExamples(arrayShuffle(examples).slice(2));
  }, []);

  const handleExampleClick = (example: string) => {
    const input = inputRef.current as HTMLInputElement;
    input.value = example;

    const contentEditable = contentEditableRef.current as HTMLSpanElement;
    contentEditable.innerText = example;
  };

  const handlePromptInput = (e: React.SyntheticEvent<HTMLSpanElement>) => {
    const span = e.target as HTMLSpanElement;
    const input = inputRef.current as HTMLInputElement;
    input.value = span.innerText;
  };

  return (
    <form
      className="mx-auto max-w-[50rem] text-center"
      onSubmit={handleFormSubmit}
    >
      <p className="mb-2 text-sm">
        Complete the sentence below to generate a character.
      </p>

      <p className="text-xs text-neutral-400">
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

      <p className="mt-12 text-xs text-neutral-400">For example...</p>

      <ul className="mt-2 text-xs text-neutral-400">
        {examples.map((example) => (
          <li
            key={example}
            className="mb-2 cursor-pointer hover:text-neutral-600"
            onClick={() => handleExampleClick(example)}
          >
            &ldquo;<span>The character is {example}.</span>&rdquo;
          </li>
        ))}
      </ul>
    </form>
  );
};
