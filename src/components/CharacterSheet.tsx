"use client";

import { type Character } from "@prisma/client";
import { useEffect, useState, useRef, use } from "react";
// import { LoadingSpinner } from "./LoadingSpinner";

import { MdModeEditOutline, MdClose, MdRefresh } from "react-icons/md";

interface CharacterSheetItemProps {
  field: keyof Character;
  label: string;
  value: string | null;
  stream: boolean;
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
    character,
    setCharacterState,
  } = props;

  const [responseText, setResponseText] = useState<string | null>(value);
  const startedGenerating = useRef<boolean>(false);
  const [doneGenerating, setDoneGenerating] = useState<boolean>(
    character[field] !== null
  );
  const [editing, setEditing] = useState<boolean>(false);

  const responseTextRef = useRef<HTMLDivElement>(null);

  // Generic function to ger a response from the API.
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

    console.log(url);

    await getResponse(url);
  };

  return (
    <div>
      {editing && <div className="fixed"></div>}
      <div
        className={`group mb-4 ${
          editing
            ? `relative z-20 shadow-[0_0_0_9999px_rgba(0,0,0,0.9)] transition-all`
            : ``
        }`}
      >
        <div className="mb-1 flex h-9 items-center text-xs text-red-600">
          <span className="uppercase tracking-[0.25em]">{label}</span>

          {doneGenerating &&
            (!editing ? (
              <button
                onClick={(e) => setEditing(true)}
                className="ml-2 flex cursor-pointer items-center justify-center border border-transparent p-2 pr-3 hover:border-red-600"
              >
                <MdModeEditOutline />{" "}
                <span className="inline-block pl-2 opacity-0 transition-all group-hover:opacity-100">
                  Edit
                </span>
              </button>
            ) : (
              <div
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
              </div>
            ))}
        </div>

        <>
          <div className="text-sm">
            {responseText ? (
              <div
                ref={responseTextRef}
                contentEditable={editing && doneGenerating}
              >
                {responseText}
              </div>
            ) : (
              "Loading..."
            )}
          </div>

          {editing && (
            <div className="absolute top-[100%] w-[100%] pt-4 text-xs text-stone-400">
              <div>
                Edit the text above OR try regenerating this field with new
                instructions.
              </div>

              {doneGenerating && (
                <form
                  onSubmit={handleRegenerateFormSubmit}
                  className="flex pt-4"
                >
                  <input
                    name="prompt"
                    placeholder="Instructions to regenerate"
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

  return (
    <div className="mx-auto mb-[120px] mt-8 max-w-2xl justify-center p-6">
      <CharacterSheetItem
        field="name"
        label="Name"
        stream={true}
        requirements={["species"]}
        character={characterState}
        value={characterState.name}
        setCharacterState={setCharacterState}
      />

      <CharacterSheetItem
        field="species"
        label="Species"
        stream={true}
        requirements={[]}
        character={characterState}
        value={characterState.species}
        setCharacterState={setCharacterState}
      />

      <CharacterSheetItem
        field="age"
        label="Age"
        stream={false}
        requirements={["species"]}
        character={characterState}
        value={characterState.age}
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
    </div>
  );
};
