import { useCallback, useEffect, useRef, useState } from "react";
import { MdModeEditOutline, MdCheck } from "react-icons/md";
import { FaDiceD20 } from "react-icons/fa";
import type { Character } from "~/utils/types";

import type { SaveResponseOptions } from "./CharacterSheet";
import { LoadingSpinner } from "./LoadingSpinner";
import { useSession } from "next-auth/react";
import { start } from "repl";

interface CharacterSheetItemProps {
  field: keyof Character;
  label: string;
  value: string | null | undefined;
  stream: boolean;
  allowRegeneration?: boolean;
  requirements?: (keyof Character)[];
  character: Character;
  saveResponse: (options: SaveResponseOptions) => Promise<void>;
  relationID?: string;
  relationIdx?: number;
  style?: "condensed" | "normal" | "header";
}

export const CharacterSheetItem: React.FC<CharacterSheetItemProps> = (
  props
) => {
  const {
    value,
    field,
    label,
    stream,
    requirements,
    style = "normal",
    character,
    allowRegeneration = true,
    relationID,
    relationIdx,
    saveResponse,
  } = props;

  const startedGenerating = useRef<boolean>(false);

  const [responseText, setResponseText] = useState<string | null | undefined>(
    value
  );

  const [doneGenerating, setDoneGenerating] = useState<boolean>(
    character[field] !== null
  );

  const [editing, setEditing] = useState<boolean>(false);

  const responseTextRef = useRef<HTMLDivElement>(null);

  const handleEditButtonClick = () => {
    setEditing(true);

    // Focus the response text with the caret at the end:
    // https://stackoverflow.com/questions/72129403/reactjs-how-to-autofocus-an-element-with-contenteditable-attribute-true-in-rea

    setTimeout(() => {
      if (!responseTextRef.current || !responseTextRef.current.childNodes[0])
        return;

      responseTextRef.current.focus();

      const textLength = responseTextRef.current.innerText.length;
      const range = document.createRange();
      const selection = window.getSelection();

      range.setStart(responseTextRef.current.childNodes[0], textLength);
      range.collapse(true);

      selection?.removeAllRanges();
      selection?.addRange(range);
    }, 0);
  };

  const handleRegenerateFormSubmit = async (
    e: React.SyntheticEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setEditing(false);

    const form = e.target as HTMLFormElement;

    const elements = form.elements as typeof form.elements & {
      prompt: { value: string };
      useExistingData: { checked: boolean };
    };

    const params = new URLSearchParams({
      id: character.id,
      regenerate: "",
      prompt: elements.prompt.value,
    });

    if (stream) {
      params.append("stream", "");
    }

    if (elements.useExistingData.checked) {
      params.append("useExistingData", "");
    }

    if (relationID) {
      params.append("relationID", relationID);
    }

    const url = `/api/character/generate/${field}/?${params.toString()}`;

    console.log(url);

    await getResponse(url);
  };

  // Generic function to get a response from the API.
  const getResponse = async (url: string) => {
    setDoneGenerating(false);
    setResponseText("");

    const response = await fetch(url);

    if (!response.ok) throw new Error(response.statusText);

    const data = response.body;

    if (!data) return;

    const reader = data.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      setResponseText((prev) => (prev ? prev + chunkValue : chunkValue));
    }

    setDoneGenerating(true);
  };

  // Generate this field if it is null when the character loads.
  useEffect(() => {
    const generateResponse = async () => {
      // If we already have a value or we are currently generating one, don't.
      if (value || startedGenerating.current) return;

      // If we need to await something else to generate this, wait.
      for (const requirement of requirements ?? []) {
        if (!character[requirement]) return;
      }

      // If this is a relation field, we need to let the other relations generate first.
      if (relationIdx) {
        const count = (
          character[field] as Array<{ description: string }>
        ).filter((item) => item.description).length;

        if (count < relationIdx) return;
      }

      // This is mostly to get around StrictMode stuff
      startedGenerating.current = true;

      await getResponse(
        `/api/character/generate/${field}/?id=${character.id}${
          stream ? "&stream" : ""
        }`
      );
    };

    generateResponse().catch(console.error);
  }, [character, field, relationIdx, requirements, stream, value]);

  // if I put saveResponse in the dep array, it breaks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saveResponseCallback = useCallback(saveResponse, []);

  // Watch for changes to the response text and save them if we are doneGenerating
  useEffect(() => {
    // Dont try this if we already had a value or if are still generating the response
    if (value || !doneGenerating || !responseText) return;

    saveResponseCallback({ value: responseText, field, relationID }).catch(
      console.error
    );
    // Again, I don't think this is right.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneGenerating, field, relationID, responseText, saveResponseCallback]);

  const handleSaveButtonClick = () => {
    const newResponseText = responseTextRef.current?.textContent ?? null;

    if (!newResponseText) return;

    if (newResponseText !== responseText) {
      saveResponse({ value: newResponseText, field, relationID }).catch(
        console.error
      );
    }

    setEditing(false);
  };

  return (
    <div>
      {editing && (
        <div
          onClick={handleSaveButtonClick}
          className="fixed bottom-0 left-0 right-0 top-0 z-10"
        ></div>
      )}
      <div
        onClick={() => (!editing ? handleEditButtonClick() : null)}
        className={`group border-b p-6 
        ${style == "condensed" ? "py-3 pt-2" : "py-5"}
        ${
          editing
            ? `relative z-20 border-transparent bg-black shadow-[0_0_0_9999px_rgba(0,0,0,0.9)] transition-all`
            : `cursor-pointer border-stone-800 hover:bg-stone-900`
        }`}
      >
        <div className="mb-1 flex h-7 items-center text-xs text-red-600">
          <span className="uppercase tracking-[0.25em]">{label}</span>

          {doneGenerating &&
            (!editing ? (
              <button
                onClick={handleEditButtonClick}
                className="ml-2 flex cursor-pointer items-center justify-center rounded border border-transparent p-1 pl-2 pr-3 hover:border-red-600"
              >
                <MdModeEditOutline />{" "}
                <span className="inline-block pl-2 opacity-0 transition-all group-hover:opacity-100">
                  Edit
                </span>
              </button>
            ) : (
              <button
                onClick={handleSaveButtonClick}
                className="ml-1 flex cursor-pointer items-center justify-center rounded border border-transparent p-1 pl-2 pr-3 hover:border-red-600"
              >
                <MdCheck />
                <span
                  className={`inline-block pl-2 transition-all ${
                    !editing ? `opacity-0 group-hover:opacity-100` : ``
                  }`}
                >
                  Save
                </span>
              </button>
            ))}
        </div>

        <>
          <div className="whitespace-pre-line text-sm">
            {responseText ? (
              <div
                ref={responseTextRef}
                contentEditable={editing && doneGenerating}
                suppressContentEditableWarning
                className={`
                  transition-colors focus:outline-none focus:ring-0 
                  ${
                    style == "header" ? `font-heading text-3xl sm:text-5xl` : ``
                  }
                  ${style == "condensed" ? `text-lg` : ``}
                `}
              >
                {responseText}
              </div>
            ) : (
              <LoadingSpinner />
            )}
          </div>

          {editing && (
            <div className="absolute top-[100%] w-[100%] text-xs text-stone-400">
              <div>
                Edit the text above,{" "}
                <button
                  className="text-white hover:text-red-600"
                  onClick={handleSaveButtonClick}
                >
                  save
                </button>{" "}
                when you&apos;re done.
              </div>

              {doneGenerating && allowRegeneration && (
                <div className="mt-4 border-t border-stone-800 pt-4">
                  <p>Or, try rerolling this field with new instructions.</p>

                  <form
                    onSubmit={handleRegenerateFormSubmit}
                    className="flex pt-4"
                  >
                    <div className="relative mr-2 flex-grow">
                      <input
                        name="prompt"
                        placeholder="Instructions for regeneration"
                        className="w-full rounded border bg-black bg-transparent px-4 py-2"
                      />
                      <div className="absolute right-3 top-[50%] -translate-y-1/2">
                        <label className="flex items-center">
                          <span className="pr-2">Use existing text?</span>
                          <input name="useExistingData" type="checkbox" />
                        </label>
                      </div>
                    </div>
                    <button
                      className="flex items-center rounded border border-red-600 pl-3 pr-4 uppercase tracking-[0.15em] text-red-600 transition-colors hover:bg-red-600 hover:text-white"
                      type="submit"
                    >
                      <FaDiceD20 className="mr-2" />
                      Reroll
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </>
      </div>
    </div>
  );
};
