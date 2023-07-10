import type { Character } from "./types";

// QUESTION:
// This file sucks. I just want to know if all the fields of the object have
// been filled out or not. Could there be a better way to do this?

const fieldsToCheck: (keyof Character)[] = [
  "physicalDescription",
  "demeanor",
  "species",
  "backstory",
  "secret",
  "roleplayTips",
  "imageURL",
  "name",
  "age",
  "height",
  "weight",
  "eyeColor",
  "hairColor",
];

const relationFieldsToCheck: (keyof Character)[] = [
  "goals",
  "friends",
  "enemies",
];

export function isCharacterComplete(character: Character) {
  for (const field of fieldsToCheck) {
    if (!character[field]) return false;
  }

  for (const field of relationFieldsToCheck) {
    if (!character[field]) return false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of character[field] as any[]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (!item.description) return false;
    }
  }

  return true;
}
