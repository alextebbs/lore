import { type Character } from "@prisma/client";
import { useEffect, useState } from "react";
import { pusherClient as pusher } from "~/utils/pusher";
import { placeholder } from "~/utils/globals";
import { TypeOutTransition } from "./TypeOutTransition";
import { LoadingSpinner } from "./LoadingSpinner";

interface SheetMetaItemProps {
  value: string | number | null;
  label?: string;
  valueClassString?: string;
  placeholder: string;
}

const SheetMetaItem: React.FC<SheetMetaItemProps> = (props) => {
  const { value, placeholder, label, valueClassString = "text-xl" } = props;

  return (
    <div className="mr-8 flex flex-col justify-end py-4">
      <h2 className={`${valueClassString} font-heading`}>
        <TypeOutTransition
          delay={100}
          value={typeof value === "number" ? value.toString() : value}
          placeholder={placeholder}
        />
      </h2>
      <div className="flex text-[0.6rem] uppercase tracking-[0.25em] text-red-600">
        {label}

        {!value && <LoadingSpinner />}
      </div>
    </div>
  );
};

interface SheetStandardItemProps {
  value: string | number | null;
  label: string;
  placeholder: string;
  decorateFirstLetter?: boolean;
}

const SheetStandardItem: React.FC<SheetStandardItemProps> = (props) => {
  const { value, placeholder, label, decorateFirstLetter = false } = props;

  return (
    <div className="mb-8">
      <div className="mb-1 flex text-xs uppercase tracking-[0.25em] text-red-600">
        {label}

        {!value && <LoadingSpinner />}
      </div>
      <div
        className={`rich-text-wrapper ${
          decorateFirstLetter
            ? `first-letter:float-left first-letter:mr-3 first-letter:font-heading first-letter:text-7xl first-letter:font-bold first-letter:text-red-700 first-line:uppercase`
            : ``
        }`}
      >
        <TypeOutTransition
          value={typeof value === "number" ? value.toString() : value}
          placeholder={placeholder}
        />
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

  useEffect(() => {
    const channel = pusher.subscribe("character");
    channel.bind(character.id, function (data: { character: Character }) {
      setCharacterState(data.character);
    });
  }, [character.id]);

  return (
    <div className="mt-8 flex justify-center">
      <div className="max-w-4xl flex-grow">
        <div className="flex border-y">
          <SheetMetaItem
            valueClassString="text-5xl tracking-[-0.05em]"
            placeholder={placeholder.name}
            value={characterState.name}
          />
          <SheetMetaItem
            placeholder={placeholder.age}
            value={characterState.species}
            label="Species"
          />
          <SheetMetaItem
            placeholder={placeholder.age}
            value={characterState.age}
            label="Age"
          />
          <SheetMetaItem
            placeholder={placeholder.height}
            value={characterState.height}
            label="Height"
          />
          <SheetMetaItem
            placeholder={placeholder.height}
            value={characterState.height}
            label="Weight"
          />
          <SheetMetaItem
            placeholder={placeholder.eyeColor}
            value={characterState.eyeColor}
            label="Eye Color"
          />
          <SheetMetaItem
            placeholder={placeholder.hairColor}
            value={characterState.hairColor}
            label="Hair Color"
          />
        </div>

        <div className="flex flex-grow">
          <div className="flex-grow pt-12">
            <SheetStandardItem
              label="Physical Description"
              value={characterState.physicalDescription}
              placeholder={placeholder.physicalDescription}
              decorateFirstLetter={true}
            />

            <SheetStandardItem
              label="Backstory"
              value={characterState.backstory}
              placeholder={placeholder.backstory}
            />
          </div>
          <div className="ml-12 border-l pl-8 pt-8">
            <div className="mb-10">
              <div className="mb-3 text-xs uppercase tracking-[0.25em] text-red-600">
                Goals
              </div>
              <div className="">
                {placeholder.goals.map((goal, idx) => (
                  <TypeOutTransition
                    key={idx}
                    value={
                      // QUESTION: Not sure how to fix ESLint error here
                      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                      characterState.goals
                        ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                          JSON.parse(characterState.goals)[idx] || null
                        : null
                    }
                    placeholder={goal}
                  />
                ))}
              </div>
            </div>

            <div className="mb-10">
              <div className="mb-3 text-xs uppercase tracking-[0.25em] text-red-600">
                Relationships
              </div>
              <div className="">
                <p className="font-placeholder uppercase">
                  LIPSUM DOLOR SIT AMET
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
