"use client";

import type { Character } from "~/utils/types";
import { useState } from "react";

import { FaDiceD20 } from "react-icons/fa";
import { BiLink } from "react-icons/bi";

import { CharacterSheetItem } from "./CharacterSheetItem";
import { CharacterSheetImage } from "./CharacterSheetImage";

interface CharacterSheetProps {
  character: Character;
}

export interface SaveResponseOptions {
  field: keyof Character;
  value: string;
  relationID?: string;
}

export const CharacterSheet: React.FC<CharacterSheetProps> = (props) => {
  const { character } = props;

  const [characterState, setCharacterState] = useState<Character>(character);
  const [lastSavedDate, setLastSavedDate] = useState<Date>(character.updatedAt);

  const [showingClipboardText, setShowingClipboardText] =
    useState<boolean>(false);

  const saveResponse = async (options: SaveResponseOptions) => {
    const { field, value, relationID } = options;

    const payload = {
      id: character.id,
      [field]: !relationID
        ? value
        : {
            update: {
              where: { id: relationID },
              data: { description: value },
            },
          },
    };

    const response = await fetch(`/api/character/save/${field}`, {
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify(payload),
    });

    console.log(`SAVED: FIELD: ${field}, VALUE: ${value}`);

    const data = (await response.json()) as { update: Character };

    setCharacterState(data.update);
    setLastSavedDate(data.update.updatedAt);
  };

  const handleShareButtonClick = async () => {
    setShowingClipboardText(true);
    await navigator.clipboard.writeText(window.location.href);
  };

  const handleRerollClick = () => {
    setCharacterState((prev) => ({
      ...prev,
      name: null,
      roleplayTips: null,
      species: null,
      age: null,
      demeanor: null,
      physicalDescription: null,
      backstory: null,
      secret: null,
    }));
  };

  return (
    <div className="mx-auto h-max w-full max-w-5xl flex-grow border-l border-r border-stone-800">
      <div className="sticky top-0 flex items-center border-b border-stone-800 bg-stone-950 p-2 text-xs text-stone-500">
        <button
          onClick={handleRerollClick}
          className="inline-flex rounded px-4 py-2  uppercase tracking-[0.15em] hover:bg-stone-900 hover:text-red-600"
        >
          Reroll
          <FaDiceD20 className="ml-2 text-base" />
        </button>
        <button
          onClick={handleShareButtonClick}
          className="relative inline-flex rounded px-4 py-2 uppercase tracking-[0.15em] hover:bg-stone-900 hover:text-red-600"
        >
          Share
          <BiLink className="ml-2 text-base" />
        </button>
        <div
          onTransitionEnd={() => setShowingClipboardText(false)}
          className={`pointer-events-none ml-2 normal-case tracking-normal text-stone-300 transition-opacity duration-300 ${
            showingClipboardText ? `opacity-1` : `opacity-0 delay-[3000ms]`
          }`}
        >
          Copied link
        </div>
        <div className="ml-auto inline-flex px-4 py-2 uppercase tracking-[0.15em]">
          Saved: {lastSavedDate.toString()}
        </div>
      </div>
      <div className="flex">
        <div className="w-[75%] pb-[120px]">
          <CharacterSheetItem
            field="name"
            label="Name"
            stream={true}
            requirements={["species"]}
            style="text-5xl font-heading"
            character={characterState}
            value={characterState.name}
            saveResponse={saveResponse}
          />
          <CharacterSheetItem
            field="roleplayTips"
            label="Tips for roleplaying"
            stream={true}
            requirements={["physicalDescription", "demeanor"]}
            character={characterState}
            value={characterState.roleplayTips}
            saveResponse={saveResponse}
          />
          <CharacterSheetItem
            field="physicalDescription"
            label="Physical Appearance"
            stream={true}
            requirements={["name", "species", "age"]}
            character={characterState}
            value={characterState.physicalDescription}
            saveResponse={saveResponse}
          />
          <CharacterSheetItem
            field="demeanor"
            label="Behavior & Demeanor"
            stream={true}
            requirements={["name", "species", "age"]}
            character={characterState}
            value={characterState.demeanor}
            saveResponse={saveResponse}
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
            saveResponse={saveResponse}
          />
          <CharacterSheetItem
            field="secret"
            label="Secret"
            stream={true}
            requirements={["name", "species", "age", "backstory"]}
            character={characterState}
            value={characterState.secret}
            saveResponse={saveResponse}
          />

          {character.goals.map((goal, index) => (
            <CharacterSheetItem
              key={goal.id}
              field="goals"
              label={`Goal ${index + 1}`}
              stream={true}
              requirements={[]}
              character={characterState}
              value={goal.description}
              saveResponse={saveResponse}
              relationID={goal.id}
            />
          ))}
        </div>
        <div className="w-[25%] border-l border-stone-800">
          <CharacterSheetImage
            character={characterState}
            saveResponse={saveResponse}
          />

          <CharacterSheetItem
            field="species"
            label="Species"
            stream={true}
            requirements={[]}
            character={characterState}
            value={characterState.species}
            allowRegeneration={false}
            saveResponse={saveResponse}
          />
          <CharacterSheetItem
            field="age"
            label="Age"
            stream={false}
            requirements={["species"]}
            character={characterState}
            value={characterState.age}
            allowRegeneration={false}
            saveResponse={saveResponse}
          />
          <CharacterSheetItem
            field="height"
            label="Height"
            stream={false}
            requirements={["physicalDescription"]}
            character={characterState}
            value={characterState.height}
            allowRegeneration={false}
            saveResponse={saveResponse}
          />
          <CharacterSheetItem
            field="weight"
            label="Weight"
            stream={false}
            requirements={["physicalDescription"]}
            character={characterState}
            value={characterState.weight}
            allowRegeneration={false}
            saveResponse={saveResponse}
          />
          <CharacterSheetItem
            field="eyeColor"
            label="Eye Color"
            stream={false}
            requirements={["physicalDescription"]}
            character={characterState}
            value={characterState.eyeColor}
            allowRegeneration={false}
            saveResponse={saveResponse}
          />
          <CharacterSheetItem
            field="hairColor"
            label="Hair Color"
            stream={false}
            requirements={["physicalDescription"]}
            character={characterState}
            value={characterState.hairColor}
            allowRegeneration={false}
            saveResponse={saveResponse}
          />
        </div>
      </div>
    </div>
  );
};
