import { type Character } from "@prisma/client";
import { useEffect, useState } from "react";
import { md2jsx } from "~/utils/md2jsx";

interface SheetMetaItemProps {
  value: string | number | null;
  label?: string;
  valueClassString?: string;
}

const SheetMetaItem: React.FC<SheetMetaItemProps> = (props) => {
  const { value, label, valueClassString = "text-3xl" } = props;

  return (
    <div className="mr-8 flex flex-col justify-end py-4">
      <h2 className={`${valueClassString} font-display`}>{value}</h2>
      {label && (
        <div className="text-[0.6rem] uppercase tracking-[0.25em] text-red-600">
          {label}
        </div>
      )}
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
    const generateMissingFields = async () => {
      let field;

      if (
        !characterState.name ||
        !characterState.age ||
        !characterState.species
      ) {
        field = "baseInfo";
      } else if (!characterState.physicalDescription) {
        field = "physicalDescription";
      } else if (!characterState.backstory) {
        field = "backstory";
      }

      if (!field) {
        return;
      }

      let url = `/api/generate/character/${field}`;
      url += "?" + new URLSearchParams({ id: characterState.id }).toString();

      const response = await fetch(url);
      const data = (await response.json()) as Character;

      setCharacterState(data);
    };

    generateMissingFields();
  }, [characterState]);

  return (
    <div className="mt-8 flex justify-center">
      <div className="max-w-4xl">
        <div className="flex border-y">
          <SheetMetaItem
            valueClassString="text-7xl tracking-[-0.05em]"
            value={characterState.name}
          />
          <SheetMetaItem value={characterState.age} label="Age" />
          <SheetMetaItem value={characterState.species} label="Species" />
          <SheetMetaItem value="5'2" label="Height" />
          <SheetMetaItem value="120 lbs" label="Weight" />
        </div>

        <div className="flex">
          <div className="pt-12">
            {characterState.physicalDescription && (
              <div>
                <div className="mb-1 text-xs uppercase tracking-[0.25em] text-red-600">
                  Physical Description
                </div>
                <div className="rich-text-wrapper first-letter:float-left first-letter:mr-3 first-letter:font-display first-letter:text-7xl first-letter:font-bold first-letter:text-red-700 first-line:uppercase">
                  {md2jsx(characterState.physicalDescription)}
                </div>
              </div>
            )}

            {characterState.backstory && (
              <div className="mb-10">
                <div className="mb-1 text-xs uppercase tracking-[0.25em] text-red-600">
                  Backstory
                </div>
                <div className="rich-text-wrapper">
                  {md2jsx(characterState.backstory)}
                </div>
              </div>
            )}
          </div>
          <div className="ml-12 border-l pl-8 pt-8">
            <div className="mb-10">
              <div className="mb-3 text-xs uppercase tracking-[0.25em] text-red-600">
                Goals
              </div>
              <div className="">
                <p>Lipsum Dolor Sit Amet.</p>
              </div>
            </div>

            <div className="mb-10">
              <div className="mb-3 text-xs uppercase tracking-[0.25em] text-red-600">
                Relationships
              </div>
              <div className="">
                <p>Lipsum Dolor Sit Amet.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
