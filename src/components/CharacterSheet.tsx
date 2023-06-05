"use client";

import { type Character } from "@prisma/client";
import { useEffect, useState, useRef, use } from "react";
// import { LoadingSpinner } from "./LoadingSpinner";

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
  const [doneGenerating, setDoneGenerating] = useState<boolean>(false);

  useEffect(() => {
    const generateResponse = async () => {
      // If we already have a value or we are currently generating one, don't.
      if (value || startedGenerating.current) return;

      // If we need to await something else to generate this, wait.
      for (const requirement of requirements ?? []) {
        if (!character[requirement]) return;
      }

      startedGenerating.current = true;

      setResponseText("");

      const response = await fetch(
        `/api/generate/character/${field}/?id=${character.id}${
          stream ? "&stream" : ""
        }`
      );

      if (!response.ok) throw new Error(response.statusText);

      // This data is a ReadableStream
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

  return (
    <div>
      {label}: {responseText || <span>Loading... </span>}
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
    <div className="mx-auto mt-8 max-w-2xl justify-center">
      <div className="mb-2">
        <CharacterSheetItem
          field="species"
          label="Species"
          stream={false}
          requirements={[]}
          character={characterState}
          value={characterState.species}
          setCharacterState={setCharacterState}
        />
      </div>

      <div className="mb-2">
        <CharacterSheetItem
          field="name"
          label="Name"
          stream={true}
          requirements={["species"]}
          character={characterState}
          value={characterState.name}
          setCharacterState={setCharacterState}
        />
      </div>

      <div className="mb-2">
        <CharacterSheetItem
          field="age"
          label="Age"
          stream={false}
          requirements={["species"]}
          character={characterState}
          value={characterState.age}
          setCharacterState={setCharacterState}
        />
      </div>

      <div className="mb-2">
        <CharacterSheetItem
          field="physicalDescription"
          label="Physical Description"
          stream={true}
          requirements={["name", "species", "age"]}
          character={characterState}
          value={characterState.physicalDescription}
          setCharacterState={setCharacterState}
        />
      </div>

      <div className="mb-2">
        <CharacterSheetItem
          field="backstory"
          label="Backstory"
          stream={true}
          requirements={["name", "species", "age", "physicalDescription"]}
          character={characterState}
          value={characterState.backstory}
          setCharacterState={setCharacterState}
        />
      </div>
    </div>
  );
};
