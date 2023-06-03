"use client";

import { type Character } from "@prisma/client";
import { useEffect, useState, useRef } from "react";
// import { LoadingSpinner } from "./LoadingSpinner";

interface CharacterSheetProps {
  character: Character;
}

export const CharacterSheet: React.FC<CharacterSheetProps> = (props) => {
  const { character } = props;

  const [characterState, setCharacterState] = useState<Character>(character);
  const [response, setResponse] = useState<string>("");
  const startedGenerating = useRef<boolean>(false);

  useEffect(() => {
    const generateResponse = async () => {
      if (startedGenerating.current) return;

      startedGenerating.current = true;

      setResponse("");

      const url = `/api/generate/character/field/?id=${characterState.id}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      // This data is a ReadableStream
      const data = response.body;
      if (!data) {
        return;
      }

      const reader = data.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value);
        setResponse((prev) => prev + chunkValue);
      }

      console.log("done");
    };

    generateResponse().catch(console.error);
  }, [characterState.id]);

  return <div className="mt-8 flex justify-center">{response}</div>;
};
