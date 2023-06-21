"use client";

import type { Character } from "~/utils/types";
import { useState } from "react";
import { FaDiceD20 } from "react-icons/fa";
import { BiLink } from "react-icons/bi";
import { CharacterSheetItem } from "./CharacterSheetItem";
import { CharacterSheetImage } from "./CharacterSheetImage";
import { useSession } from "next-auth/react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { LoadingSpinner } from "./LoadingSpinner";

dayjs.extend(relativeTime); // use plugin

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
  const [lastSavedDate, setLastSavedDate] = useState<Date>(
    new Date(character.updatedAt)
  );

  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [showingClipboardText, setShowingClipboardText] =
    useState<boolean>(false);

  const session = useSession();

  const saveResponse = async (options: SaveResponseOptions) => {
    setIsSaving(true);

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
    setLastSavedDate(new Date(data.update.updatedAt));
    setIsSaving(false);
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
    <div className="mx-auto h-max min-h-screen w-full max-w-5xl flex-grow border-l border-r border-stone-800">
      <div className="z-10 flex items-center border-b border-stone-800 bg-stone-950 p-2 text-xs text-stone-500 sm:sticky sm:top-0">
        {session && (
          <button
            onClick={handleRerollClick}
            className="inline-flex rounded px-4 py-2  uppercase tracking-[0.15em] hover:bg-stone-900 hover:text-red-600"
          >
            Reroll
            <FaDiceD20 className="ml-2 text-base" />
          </button>
        )}
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
        {isSaving ? (
          <div className="ml-auto px-4">
            <LoadingSpinner text="Saving" spinner={true} />
          </div>
        ) : (
          <div className="ml-auto inline-flex px-4 py-2 uppercase tracking-[0.15em]">
            Saved:{" "}
            {new Date().getTime() - lastSavedDate.getTime() >
            1000 * 60 * 60 * 24
              ? dayjs(lastSavedDate).format("MM/DD/YY @ h:mm A")
              : dayjs(lastSavedDate).fromNow()}
          </div>
        )}
      </div>
      <div className="flex flex-col-reverse sm:flex-row">
        <div className="flex-grow">
          <div className="flex flex-col justify-end sm:min-h-[255px]">
            {characterState.originStatement && (
              <div className="mb-auto p-4 text-xs text-stone-600">
                Prompt: {characterState.originStatement || "none"}.
              </div>
            )}

            <CharacterSheetItem
              field="name"
              label="Name"
              stream={true}
              requirements={["species"]}
              style="header"
              character={characterState}
              value={characterState.name}
              saveResponse={saveResponse}
            />
          </div>
        </div>
        <div className="shrink-0 border-l border-stone-800 sm:w-[255px]">
          <CharacterSheetImage
            character={characterState}
            saveResponse={saveResponse}
          />
        </div>
      </div>
      <div className="flex flex-col-reverse sm:flex-row">
        <div className="flex-grow pb-[120px]">
          <CharacterSheetItem
            field="roleplayTips"
            label="Roleplaying Tips"
            stream={true}
            requirements={["physicalDescription", "demeanor"]}
            character={characterState}
            value={characterState.roleplayTips}
            saveResponse={saveResponse}
          />
          <CharacterSheetItem
            field="physicalDescription"
            label="Appearance"
            stream={true}
            requirements={["name", "species", "age"]}
            character={characterState}
            value={characterState.physicalDescription}
            saveResponse={saveResponse}
          />
          <CharacterSheetItem
            field="demeanor"
            label="Behavior"
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

          {character.goals.map((item, index) => (
            <CharacterSheetItem
              key={item.id}
              field="goals"
              label={`Goal ${index + 1}`}
              stream={true}
              requirements={["backstory", "secret", "name"]}
              character={characterState}
              value={item.description}
              saveResponse={saveResponse}
              relationID={item.id}
              relationIdx={index}
            />
          ))}

          {/* {character.friends.map((item, index) => (
            <CharacterSheetItem
              key={item.id}
              field="goals"
              label={`Friend ${index + 1}`}
              stream={true}
              requirements={["backstory", "secret", "name"]}
              character={characterState}
              value={item.description}
              saveResponse={saveResponse}
              relationID={item.id}
            />
          ))}
          {character.enemies.map((item, index) => (
            <CharacterSheetItem
              key={item.id}
              field="goals"
              label={`Enemy ${index + 1}`}
              stream={true}
              requirements={["backstory", "secret", "name"]}
              character={characterState}
              value={item.description}
              saveResponse={saveResponse}
              relationID={item.id}
            />
          ))} */}
        </div>
        <div className="shrink-0 border-l border-stone-800 sm:w-[255px]">
          <CharacterSheetItem
            field="species"
            label="Species"
            stream={true}
            requirements={[]}
            character={characterState}
            value={characterState.species}
            allowRegeneration={false}
            saveResponse={saveResponse}
            style={"condensed"}
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
            style={"condensed"}
          />
          <CharacterSheetItem
            field="height"
            label="Height"
            stream={false}
            requirements={["physicalDescription"]}
            value={characterState.height}
            allowRegeneration={false}
            character={characterState}
            saveResponse={saveResponse}
            style={"condensed"}
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
            style={"condensed"}
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
            style={"condensed"}
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
            style={"condensed"}
          />
        </div>
      </div>
    </div>
  );
};
