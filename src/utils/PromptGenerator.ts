import { outdent } from "outdent";

import { type Character } from "@prisma/client";

export class PromptGenerator {
  generateKnownCharacterInfo(character: Character) {
    return outdent`
      You are going to help create a character for use in a fantasy roleplaying
      campaign setting. You should seek to create characters that are creative,
      distinct, and dynamic. 

      The following information is known about the character already. Use this
      information when creating your response.

      ${
        character.originStatement
          ? `The character is ${character.originStatement}.`
          : ``
      }
      ${character.species ? `The character is a ${character.species}.` : ``}
      ${character.age ? `The character is ${character.age} years old.` : ``}
      ${character.name ? `The character is named ${character.name}.` : ``}
      ${character.height ? `The character is ${character.height} tall.` : ``}
      ${character.weight ? `The character weighs ${character.weight}.` : ``}
      ${
        character.physicalDescription
          ? `Physical description of the character: ${character.physicalDescription}.`
          : ``
      }
      ${
        character.backstory
          ? `Character's backstory: ${character.backstory}.`
          : ``
      }
    `;
  }

  generateSpeciesPrompt(
    character: Character,
    regenPrompt: string | null = null
  ) {
    return outdent`
      ${this.generateKnownCharacterInfo(character)}

      Now, generate a new species for the character. Choose from the following
      options. If the species has a subspecies, select a subspecies as well.

      - Human
      - Elf
      - Dwarf
      - Halfling
      - Gnome
      - Dragonborn
      - Tiefling
      - Orc
      - Goblin
      - Kobold
      - Lizardfolk
      - Tabaxi
      - Aarakocra
      - Kenku
      - Goliath
      - Genasi
      - Triton
      - Yuan-Ti
      - Aasimar
      - Warforged
      - Tortle
      - Firbolg
      - Gith
      - Changeling
      - Kalashtar
      - Shifter
      - Minotaur
      - Centaur
      - Leonin
      - Satyr
      - Vedalken
      - Loxodon
      - Simic Hybrid
      - Grung
      - Locathah

      Return the species as a single word. Use no punctuation in your response.

      ${
        regenPrompt
          ? `Use the following instruction when generating a response: ${regenPrompt}`
          : ``
      }

      Character's species:
    `;
  }

  generateAgePrompt(character: Character, regenPrompt: string | null = null) {
    return outdent`
      ${this.generateKnownCharacterInfo(character)}

      Now, generate a new age for the character. 

      Return the age as a single number. Use no punctuation in your response.

      Examples: 25, 50, 100

      ${
        regenPrompt
          ? `Use the following instruction when generating a response: ${regenPrompt}`
          : ``
      }

      Character's age:
    `;
  }

  generateNamePrompt(character: Character, regenPrompt: string | null = null) {
    return outdent`
      ${this.generateKnownCharacterInfo(character)}

      Now, generate a new name for the character. 

      Return the name as 1-3 words. Use no periods in your response.

      ${
        regenPrompt
          ? `Use the following instruction when generating a response: ${regenPrompt}`
          : ``
      }

      Character's name:
    `;
  }

  generatePhysicalDescriptionPrompt(
    character: Character,
    regenPrompt: string | null = null
  ) {
    return outdent`
      ${this.generateKnownCharacterInfo(character)}

      Now, write a single paragraph description of the character's physical
      appearance, noting something that is unique, distinct, and memorable about
      their physical form. This description should be 1-2 sentences long.

      Follow the following style notes:
        - Your description should be evocative, but not overly poetic.
        - Describe only the physical appearance, not behavior or demeanor.
        - Use the present tense at all times.

      ${
        regenPrompt
          ? `Use the following instruction when generating a response: ${regenPrompt}`
          : ``
      }

      Physical description of ${character.name}:
    `;
  }

  generateDemeanorPrompt(
    character: Character,
    regenPrompt: string | null = null
  ) {
    return outdent`
      ${this.generateKnownCharacterInfo(character)}

      Now, write a single paragraph description of the character's behavior and
      demeanor, noting something that is unique, distinct, and memorable about
      their presence, speaking style, or mannerisms. This description should be
      1-2 sentences long.

      Follow the following style notes:
        - Your description should be evocative, but not overly poetic.
        - Describe only the behavior and demeanor of the character, not their physical appearance.
        - Use the present tense at all times.

      ${
        regenPrompt
          ? `Use the following instruction when generating a response: ${regenPrompt}`
          : ``
      }

      Demeanor of ${character.name}:
    `;
  }

  generateBackstoryPrompt(
    character: Character,
    regenPrompt: string | null = null
  ) {
    return outdent`
      ${this.generateKnownCharacterInfo(character)}

      Now, write a backstory describing the character's history. The backstory
      should be a single paragraph in length.

      Follow the following style notes:
        - Your backstory should be evocative, but not overly poetic.

      ${
        regenPrompt
          ? `Use the following instruction when generating a response: ${regenPrompt}`
          : ``
      }

      Character's backstory: 
    `;
  }

  // QUESTION
  // I guess I need this to map the field string (which comes from the URL) to
  // the correct method. Is there a better way to do this?
  // Could I do something like this?

  // generate(character: Character, field: keyof Character) {
  //   if (!field || field.length == 0) return;

  //   const methodToCall = `generate${field.charAt(0).toUpperCase() + field.slice(1)}Prompt`;

  //   // This line below makes typescript angry.
  //   return this[methodToCall](character);
  // }

  generate(
    character: Character,
    field: keyof Character,
    regenerate = false,
    regenPrompt: string | null = null
  ) {
    // if (regenerate) {
    //   console.log("REGENERATING WITH PROMPT: ", regenPrompt);
    //   character[field] = null;
    // }

    switch (field) {
      case "physicalDescription":
        return this.generatePhysicalDescriptionPrompt(character, regenPrompt);

      case "demeanor":
        return this.generateDemeanorPrompt(character, regenPrompt);

      case "backstory":
        return this.generateBackstoryPrompt(character, regenPrompt);

      case "age":
        return this.generateAgePrompt(character, regenPrompt);

      case "name":
        return this.generateNamePrompt(character, regenPrompt);

      case "species":
        return this.generateSpeciesPrompt(character, regenPrompt);
    }

    throw new Error("Invalid field");
  }
}
