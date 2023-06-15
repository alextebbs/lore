"use client";

import type { Character } from "~/utils/types";
import { useEffect, useState, useRef, use } from "react";
// import { LoadingSpinner } from "./LoadingSpinner";

import { MdModeEditOutline, MdClose, MdRefresh } from "react-icons/md";

interface CharacterSheetItemProps {
  field: keyof Character;
  label: string;
  value: string | null | undefined;
  stream: boolean;
  style?: string;
  allowRegenerationInstructions?: boolean;
  requirements?: (keyof Character)[];
  character: Character;
  setCharacterState: React.Dispatch<React.SetStateAction<Character>>;
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
    style = "",
    character,
    setCharacterState,
    allowRegenerationInstructions = true,
  } = props;

  const [responseText, setResponseText] = useState<string | null | undefined>(
    value
  );
  const startedGenerating = useRef<boolean>(false);
  const [doneGenerating, setDoneGenerating] = useState<boolean>(
    character[field] !== null
  );
  const [editing, setEditing] = useState<boolean>(false);

  const responseTextRef = useRef<HTMLDivElement>(null);

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

      // This is mostly to get around StrictMode stuff
      startedGenerating.current = true;

      await getResponse(
        `/api/generate/character/${field}/?id=${character.id}${
          stream ? "&stream" : ""
        }`
      );
    };

    generateResponse().catch(console.error);
  }, [
    field,
    stream,
    character,
    setCharacterState,
    requirements,
    responseText,
    value,
  ]);

  // Watch for changes to the response text and save them if we are doneGenerating
  useEffect(() => {
    if (!doneGenerating) return;

    // This should be factored out into a stanalone function
    const saveResponse = async () => {
      await fetch(`/api/save/character/${field}`, {
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ [field]: responseText, id: character.id }),
      });

      setCharacterState((prev) => ({ ...prev, [field]: responseText }));
    };

    saveResponse().catch(console.error);
  }, [responseText, field, setCharacterState, character.id, doneGenerating]);

  const handleSaveButtonClick = () => {
    const newResponseText = responseTextRef.current?.textContent ?? null;

    if (!newResponseText) return;

    // This should be factored out into a stanalone function
    const saveResponse = async () => {
      await fetch(`/api/save/character/${field}`, {
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ [field]: newResponseText, id: character.id }),
      });

      setCharacterState((prev) => ({ ...prev, [field]: newResponseText }));
    };

    saveResponse().catch(console.error);

    setEditing(false);
  };

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
    };

    let url = `/api/generate/character/${field}/?id=${character.id}&regenerate${
      stream ? "&stream" : ""
    }`;

    if (elements.prompt.value) {
      url += `&prompt=${elements.prompt.value}`;
    }

    await getResponse(url);
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
        className={`group border-b p-6 ${
          editing
            ? `relative z-20 border-transparent bg-black shadow-[0_0_0_9999px_rgba(0,0,0,0.9)] transition-all`
            : `cursor-pointer border-stone-800 hover:bg-stone-900`
        }`}
      >
        <div className="mb-1 flex h-9 items-center text-xs text-red-600">
          <span className="uppercase tracking-[0.25em]">{label}</span>

          {doneGenerating &&
            (!editing ? (
              <button
                onClick={handleEditButtonClick}
                className="ml-2 flex cursor-pointer items-center justify-center border border-transparent p-2 pr-3 hover:border-red-600"
              >
                <MdModeEditOutline />{" "}
                <span className="inline-block pl-2 opacity-0 transition-all group-hover:opacity-100">
                  Edit
                </span>
              </button>
            ) : (
              <button
                onClick={handleSaveButtonClick}
                className="ml-2 flex cursor-pointer items-center justify-center border border-transparent p-2 pr-3 hover:border-red-600"
              >
                <MdClose />
                <span
                  className={`inline-block pl-2 transition-all ${
                    !editing ? `opacity-0 group-hover:opacity-100` : ``
                  }`}
                >
                  Close
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
                className={`${style} transition-colors focus:outline-none focus:ring-0`}
              >
                {responseText}
              </div>
            ) : (
              "Loading..."
            )}
          </div>

          {editing && (
            <div className="absolute top-[100%] w-[100%] text-xs text-stone-400">
              <div>
                Edit the text above
                {allowRegenerationInstructions && (
                  <> OR try regenerating this field with new instructions</>
                )}
                .
              </div>

              {doneGenerating && allowRegenerationInstructions && (
                <form
                  onSubmit={handleRegenerateFormSubmit}
                  className="flex pt-4"
                >
                  <input
                    name="prompt"
                    placeholder="Instructions for regeneration"
                    className="mr-2 flex-1 border bg-transparent px-4 py-2"
                  />
                  <button
                    className="flex items-center border border-red-600 pl-3 pr-4 text-red-600 transition-colors hover:bg-red-600 hover:text-white"
                    type="submit"
                  >
                    <span className="mr-2 text-xl">
                      <MdRefresh />
                    </span>
                    Regenerate
                  </button>
                </form>
              )}
            </div>
          )}
        </>
      </div>
    </div>
  );
};

interface CharacterSheetProps {
  character: Character;
}

export const CharacterSheet: React.FC<CharacterSheetProps> = (props) => {
  const { character } = props;

  const [characterState, setCharacterState] = useState<Character>(character);

  const saveResponse = async (
    characterID: string,
    field: keyof Character,
    value: string
  ) => {
    const response = await fetch(`/api/save/character/${field}`, {
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({ [field]: value, id: characterID }),
    });

    const data = (await response.json()) as { update: Character };

    setCharacterState(data.update);
  };

  const saveRelationalResponse = async (
    characterID: string,
    relation: keyof Character,
    relationField: string,
    relationValue: string,
    relationID: string
  ) => {
    const response = await fetch(`/api/save/character/${relation}`, {
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        id: characterID,
        [relation]: {
          update: {
            where: {
              id: relationID,
            },
            data: {
              [relationField]: relationValue,
            },
          },
        },
      }),
    });

    const data = (await response.json()) as { update: Character };

    setCharacterState(data.update);
  };

  useEffect(() => {
    // console.log(
    //   saveRelationalResponse(
    //     "cliveva1y0000pb0g7oxcnush",
    //     "goals",
    //     "description",
    //     "Goal Test ABCD",
    //     "cliw9i7xn0000rt0hrpyzf2f0"
    //   )
    // );
    console.log(Array.from(characterState.goals));
  }, []);

  return (
    <div className="mx-auto w-[100%] max-w-5xl">
      {/* {Array.from(characterState.goals).map((goal, index) => (
        <CharacterSheetItem
          key={index}
          field="goals"
          label="Goal"
          stream={true}
          requirements={["species"]}
          style="text-5xl font-heading"
          character={characterState}
          value={characterState.goals[index]?.description}
          setCharacterState={setCharacterState}
        />
      ))} */}

      {characterState.goals.map((goal, index) => (
        <div key={index}>{goal.description}</div>
      ))}

      <div className="flex min-h-[100%]">
        <div className="w-[75%] border-l border-r border-stone-800 pb-[120px]">
          <CharacterSheetItem
            field="name"
            label="Name"
            stream={true}
            requirements={["species"]}
            style="text-5xl font-heading"
            character={characterState}
            value={characterState.name}
            setCharacterState={setCharacterState}
          />
          <CharacterSheetItem
            field="roleplayTips"
            label="Tips for roleplaying"
            stream={true}
            requirements={["physicalDescription", "demeanor"]}
            character={characterState}
            value={characterState.roleplayTips}
            setCharacterState={setCharacterState}
          />
          <CharacterSheetItem
            field="physicalDescription"
            label="Physical Appearance"
            stream={true}
            requirements={["name", "species", "age"]}
            character={characterState}
            value={characterState.physicalDescription}
            setCharacterState={setCharacterState}
          />
          <CharacterSheetItem
            field="demeanor"
            label="Behavior & Demeanor"
            stream={true}
            requirements={["name", "species", "age"]}
            character={characterState}
            value={characterState.demeanor}
            setCharacterState={setCharacterState}
          />
          <CharacterSheetItem
            field="backstory"
            label="Backstory"
            stream={true}
            requirements={[
              "name",
              "species",
              "age",
              "physicalDescription",
              "demeanor",
            ]}
            character={characterState}
            value={characterState.backstory}
            setCharacterState={setCharacterState}
          />
          <CharacterSheetItem
            field="secret"
            label="Secret"
            stream={true}
            requirements={["name", "species", "age", "backstory"]}
            character={characterState}
            value={characterState.secret}
            setCharacterState={setCharacterState}
          />
        </div>
        <div className="w-[25%] border-r border-stone-800">
          <CharacterSheetItem
            field="species"
            label="Species"
            stream={true}
            requirements={[]}
            character={characterState}
            value={characterState.species}
            setCharacterState={setCharacterState}
            allowRegenerationInstructions={false}
          />
          <CharacterSheetItem
            field="age"
            label="Age"
            stream={false}
            requirements={["species"]}
            character={characterState}
            value={characterState.age}
            setCharacterState={setCharacterState}
            allowRegenerationInstructions={false}
          />
        </div>
      </div>
    </div>
  );
};
