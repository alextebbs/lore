import { useCallback, useEffect, useRef } from "react";
import type { Character } from "~/utils/types";
import Image from "next/image";
import type { SaveResponseOptions } from "./CharacterSheet";

interface CharacterSheetImageProps {
  character: Character;
  saveResponse: (options: SaveResponseOptions) => Promise<void>;
}

export const CharacterSheetImage: React.FC<CharacterSheetImageProps> = (
  props
) => {
  const { character, saveResponse } = props;

  const startedGenerating = useRef<boolean>(false);

  // if I put saveResponse in the dep array, it breaks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saveResponseCallback = useCallback(saveResponse, []);

  useEffect(() => {
    if (startedGenerating.current || character.imageURL) return;

    const getImageURL = async () => {
      if (!character.eyeColor || !character.hairColor || !character.species) {
        return;
      }

      // This is mostly to get around StrictMode stuff
      startedGenerating.current = true;

      const response = await fetch(
        `/api/character/image?eyeColor=${character.eyeColor}&hairColor=${character.hairColor}&species=${character.species}`
      );

      if (!response.ok) throw new Error(response.statusText);

      const imageURL = (await response.json()) as string;

      saveResponseCallback({ value: imageURL, field: "imageURL" }).catch(
        console.error
      );
    };

    getImageURL().catch(console.error);
  }, [
    character.eyeColor,
    character.hairColor,
    character.imageURL,
    character.species,
    saveResponseCallback,
  ]);

  return (
    <div>
      {character.imageURL && (
        <Image
          src={character.imageURL}
          alt={`Portrait of ${character.name || `your character`}`}
        />
      )}
    </div>
  );
};
