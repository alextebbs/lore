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
      <svg className="hidden" image-rendering="optimizeSpeed">
        {/* https://github.com/tomren1/dither-with-css  */}
        <filter
          id="dither"
          color-interpolation-filters="sRGB"
          x="0"
          y="0"
          width="100%"
          height="100%"
        >
          <feImage
            width="4"
            height="4"
            xlinkHref="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAG0lEQVR42mNgYGD4X19f/59h//79/+3t7f8DAEGyCHSQnFc+AAAAAElFTkSuQmCC"
          />
          <feTile />
          <feComposite
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="1"
            k4="-0.5"
            in="SourceGraphic"
          />
          <feComponentTransfer>
            <feFuncR type="discrete" tableValues="0 1" />
            <feFuncG type="discrete" tableValues="0 1" />
            <feFuncB type="discrete" tableValues="0 1" />
          </feComponentTransfer>
        </filter>
      </svg>
      {character.imageURL ? (
        <img
          src={character.imageURL}
          width={255}
          height={255}
          className="w-full sm:w-auto"
          style={{ filter: "url(#dither)" }}
          alt={`Portrait of ${character.name || `your character`}`}
        />
      ) : (
        <div className="flex h-[255px] flex-col items-center justify-center">
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
          <div className="mt-3 text-xs uppercase tracking-[0.15em] text-stone-700">
            Generating image
          </div>
        </div>
      )}
    </div>
  );
};
