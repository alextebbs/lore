import { useEffect, useRef } from "react";
import type { Character } from "~/utils/types";
import type { SaveResponseOptions } from "./CharacterSheet";
import { Canvas } from "@react-three/fiber";
import { Dice } from "./Dice";
import Image from "next/image";
import { FaDiceD20 } from "react-icons/fa";
import { useSession } from "next-auth/react";

interface CharacterSheetImageProps {
  character: Character;
  saveResponse: (options: SaveResponseOptions) => Promise<void>;
}

export const CharacterSheetImage: React.FC<CharacterSheetImageProps> = (
  props
) => {
  const { character, saveResponse } = props;

  const isGenerating = useRef<boolean>(false);

  useEffect(() => {
    (async () => {
      if (isGenerating.current || character.imageURL) return;

      if (!character.eyeColor || !character.hairColor || !character.species) {
        return;
      }

      // This is mostly to get around StrictMode stuff
      isGenerating.current = true;

      const response = await fetch(
        `/api/character/image?eyeColor=${character.eyeColor}&hairColor=${character.hairColor}&species=${character.species}`
      );

      if (!response.ok) throw new Error(response.statusText);

      const imageURL = (await response.json()) as string;

      await saveResponse({ value: imageURL, field: "imageURL" });

      isGenerating.current = false;
    })().catch(console.error);
  }, [character, saveResponse]);

  const session = useSession();
  const user = session?.data?.user;

  const handleReroll = async () => {
    await saveResponse({ value: null, field: "imageURL" });
  };

  return (
    <div className="group border-b border-stone-800">
      <svg className="hidden" imageRendering="optimizeSpeed">
        {/* https://github.com/tomren1/dither-with-css  */}
        <filter
          id="dither"
          colorInterpolationFilters="sRGB"
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
        <div className="relative">
          <Image
            src={character.imageURL}
            width={510}
            height={510}
            className="w-full"
            style={{ filter: "url(#dither)" }}
            alt={`Portrait of ${character.name || `your character`}`}
          />
          {user && (
            <button
              onClick={handleReroll}
              className="absolute bottom-0 left-0 right-0 hidden justify-center rounded bg-black/75 px-4 py-3 text-xs uppercase tracking-[0.15em] hover:text-red-600 group-hover:inline-flex"
            >
              Reroll Image <FaDiceD20 className="ml-2 text-base" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex h-[254px] flex-col items-center justify-center">
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
