/* eslint-disable @next/next/no-img-element */
// ^ passing on this for now

import { useCallback, useEffect, useRef } from "react";
import type { Character } from "~/utils/types";
import type { SaveResponseOptions } from "./CharacterSheet";
import { LoadingSpinner } from "./LoadingSpinner";
import { Canvas } from "@react-three/fiber";
import { Dice } from "./Dice";

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
    <div className="border-b border-stone-800">
      {character.imageURL ? (
        <img
          src={character.imageURL}
          width={255}
          height={255}
          className="w-full sm:w-auto"
          alt={`Portrait of ${character.name || `your character`}`}
        />
      ) : (
        <div className="flex h-[255px] items-center justify-center bg-black">
          <div className="h-[48px] w-[48px]">
            <Canvas
              gl={{ antialias: true }}
              orthographic
              camera={{
                near: 0,
                position: [0, 0, 100],
              }}
            >
              <Dice isHovered={false} />
            </Canvas>
          </div>
        </div>
      )}
    </div>
  );
};
