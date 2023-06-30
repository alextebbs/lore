import { useEffect, useRef, useState } from "react";
import { MdModeEditOutline, MdCheck } from "react-icons/md";
import { FaDiceD20 } from "react-icons/fa";
import type { Character } from "~/utils/types";

import type { SaveResponseOptions } from "./CharacterSheet";
import { LoadingSpinner } from "./LoadingSpinner";
import { cn } from "~/utils/cn";
import { useSession } from "next-auth/react";

interface CharacterSheetItemProps {
  field: keyof Character;
  label: string;
  value: string | null | undefined;
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
    requirements,
    style = "normal",
    character,
    allowRegeneration = true,
    relationID,
    relationIdx,
    saveResponse,
  } = props;

  const [responseText, setResponseText] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState<boolean>(false);

  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);

  const isEditable = value && !isRegenerating;

  const valueTextRef = useRef<HTMLDivElement>(null);

  const handleEditButtonClick = () => {
    setIsEditing(true);

    // Focus the response text with the caret at the end:
    // https://stackoverflow.com/questions/72129403/reactjs-how-to-autofocus-an-element-with-contenteditable-attribute-true-in-rea
    setTimeout(() => {
      if (!valueTextRef.current || !valueTextRef.current.childNodes[0]) return;

      valueTextRef.current.focus();

      const textLength = valueTextRef.current.innerText.length;
      const range = document.createRange();
      const selection = window.getSelection();

      range.setStart(valueTextRef.current.childNodes[0], textLength);
      range.collapse(true);

      selection?.removeAllRanges();
      selection?.addRange(range);
    }, 0);
  };

  const handleRegenerateFormSubmit = async (
    e: React.SyntheticEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setIsEditing(false);
    setIsRegenerating(true);

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

    if (elements.useExistingData.checked) {
      params.append("useExistingData", "");
    }

    if (relationID) {
      params.append("relationID", relationID);
    }

    const url = `/api/character/generate/${field}/?${params.toString()}`;

    await getAndSaveResponse(url);

    setIsRegenerating(false);
  };

  // Generic function to get a response from the API.
  const getAndSaveResponse = async (url: string) => {
    setResponseText("");

    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(character),
    });

    if (!response.ok) throw new Error(response.statusText);

    const data = response.body;

    if (!data) return;

    const reader = data.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let result = "";

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      result += chunkValue;
      setResponseText(result);
    }

    await saveResponse({ value: result, field, relationID });
    setResponseText(null);
  };

  // QUESTION:
  // I'm using this isGenerating ref to prevent the useEffect from running
  // twice on initial render due to StrictMode. This seems like a hack.
  // What is the better way to do this? If I remove this ref and the checks
  // for it, everything starts to wack out because this useEffect runs twice.
  // Does the first running of the useEffect under StrictMode need to be
  // "cleaned up" somehow to make the second running of it not cause issues?
  const isGenerating = useRef<boolean>(false);

  useEffect(() => {
    if (value || isGenerating.current) {
      return;
    }

    for (const requirement of requirements ?? []) {
      if (!character[requirement]) return;
    }

    // If this is a relation field, let the other relations generate first.
    if (relationIdx) {
      const count = (character[field] as Array<{ description: string }>).filter(
        (item) => item.description
      ).length;

      if (count < relationIdx) return;
    }

    (async () => {
      isGenerating.current = true;
      await getAndSaveResponse(
        `/api/character/generate/${field}/?id=${character.id}`
      );
      isGenerating.current = false;
    })().catch(console.error);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character, value]);

  const handleSaveButtonClick = async () => {
    setIsEditing(false);

    const newResponseText = valueTextRef.current?.textContent ?? null;

    if (!newResponseText) return;

    if (newResponseText !== responseText) {
      await saveResponse({ value: newResponseText, field, relationID });
      setResponseText(null);
    }
  };

  const session = useSession();
  const user = session?.data?.user;

  return (
    <div>
      {isEditing && isEditable && (
        <div
          onClick={handleSaveButtonClick}
          className="absolute inset-0 z-10 bg-black bg-opacity-90 transition-all"
        ></div>
      )}
      <div
        onClick={() =>
          !isEditing && isEditable && user ? handleEditButtonClick() : null
        }
        className={cn(
          "group border-b p-6",
          style === "condensed" && "py-3 pt-2",
          style !== "condensed" && "py-5",
          !isEditing && "border-stone-800",
          isEditable &&
            !isEditing &&
            user &&
            "cursor-pointer hover:bg-stone-900",
          isEditing &&
            "relative z-20 border-transparent bg-black transition-all"
        )}
      >
        <div className="mb-1 flex h-7 items-center text-xs text-red-600">
          <span className="uppercase tracking-[0.25em]">{label}</span>

          {isEditable &&
            user &&
            (!isEditing ? (
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
                className="ml-2 flex cursor-pointer items-center justify-center rounded border border-transparent p-1 pl-2 pr-3 hover:border-red-600"
              >
                <MdCheck />
                <span
                  className={cn(
                    "inline-block pl-2 transition-all",
                    !isEditing && "opacity-0 group-hover:opacity-100"
                  )}
                >
                  Save
                </span>
              </button>
            ))}
        </div>

        <>
          <div className="whitespace-pre-line text-sm">
            <div
              className={cn(
                style === "header" && `font-heading text-3xl sm:text-5xl`,
                style === "condensed" && `text-lg`
              )}
            >
              {user ? (
                isEditable ? (
                  <div
                    ref={valueTextRef}
                    contentEditable={isEditing}
                    suppressContentEditableWarning
                    className="focus:outline-none focus:ring-0"
                  >
                    {value}
                  </div>
                ) : responseText ? (
                  <div className="text-stone-400">{responseText}</div>
                ) : (
                  <LoadingSpinner />
                )
              ) : value ? (
                <>{value}</>
              ) : responseText ? (
                <div className="text-stone-400">{responseText}</div>
              ) : (
                <LoadingSpinner />
              )}
            </div>
          </div>

          {isEditing && (
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

              {isEditable && allowRegeneration && (
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
