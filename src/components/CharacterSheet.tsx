import { type ICharacter } from "~/utils/Character";
import { md2jsx } from "~/utils/md2jsx";

interface SheetMetaItemProps {
  value: string | number | undefined;
  label?: string;
  valueClassString?: string;
}

const SheetMetaItem: React.FC<SheetMetaItemProps> = (props) => {
  const { value, label, valueClassString = "text-3xl lowercase" } = props;

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
  character: ICharacter;
}

export const CharacterSheet: React.FC<CharacterSheetProps> = (props) => {
  const { character } = props;

  return (
    <div className="mt-8 flex justify-center">
      <div className="max-w-4xl">
        <div className="flex border-y">
          <SheetMetaItem valueClassString="text-7xl" value={character.name} />
          <SheetMetaItem value={character.age} label="Age" />
          <SheetMetaItem value={character.species} label="Species" />
          <SheetMetaItem value="5'2" label="Height" />
          <SheetMetaItem value="120 lbs" label="Weight" />
        </div>

        <div className="flex">
          <div className="pt-12">
            {character.physicalDescription && (
              <div>
                <div className="mb-1 text-xs uppercase tracking-[0.25em] text-red-600">
                  Physical Description
                </div>
                <div className="rich-text-wrapper">
                  {md2jsx(character.physicalDescription)}
                </div>
              </div>
            )}

            {character.backstory && (
              <div className="mb-10">
                <div className="mb-1 text-xs uppercase tracking-[0.25em] text-red-600">
                  Backstory
                </div>
                <div className="">{md2jsx(character.backstory)}</div>
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
