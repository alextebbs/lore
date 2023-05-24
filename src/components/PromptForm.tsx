import { FormEventHandler } from "react";
import { useRef } from "react";

interface PromptFormProps {
  handleFormSubmit: FormEventHandler<HTMLFormElement>;
}

export const PromptForm: React.FC<PromptFormProps> = (props) => {
  const { handleFormSubmit } = props;
  const inputRef = useRef<HTMLInputElement>(null);

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
      <p className="text-xs">
        Complete the sentence below to generate a character.
      </p>

      <div className="my-8 font-mono text-3xl">
        The character is{" "}
        <span
          contentEditable
          onInput={handlePromptInput}
          className="inline-block min-w-[200px] border-b text-left focus:outline-none"
        ></span>
        .
      </div>
      <div>
        <button
          className="border border-red-600 p-4 px-8 text-xs uppercase tracking-[0.5em] text-red-600 transition-colors hover:bg-red-600 hover:text-white"
          type="submit"
        >
          Generate
        </button>
      </div>
      <input ref={inputRef} type="hidden" name="prompt" />
    </form>
  );
};
