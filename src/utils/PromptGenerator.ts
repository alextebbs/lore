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

  generateSpeciesPrompt(character: Character) {
    return outdent`
      ${this.generateKnownCharacterInfo(character)}

      Now, pick the character's species. Choose from the following
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
    `;
  }

  generateAgePrompt(character: Character) {
    return outdent`
      ${this.generateKnownCharacterInfo(character)}

      Now, pick an age for the character. 

      Return the age as a single number. Use no punctuation in your response.

      Examples: 25, 50, 100
    `;
  }

  generateNamePrompt(character: Character) {
    return outdent`
      ${this.generateKnownCharacterInfo(character)}

      Now, pick the character's name. 

      Return the name as 1-3 words. Use no periods in your response.
    `;
  }

  generatePhysicalDescriptionPrompt(character: Character) {
    return outdent`
      ${this.generateKnownCharacterInfo(character)}

      Now, write a single paragraph description of the character's physical
      appearance, noting something that is unique, distinct, and memorable about
      their physical form. This description should be 1-2 sentences long.

      Follow the following style notes:
        - Your description should be evocative, but not overly poetic.
        - Describe only the physical appearance, not behavior or demeanor.
        - Use the present tense at all times.

      Physical description of ${character.name}:
    `;
  }

  generateBackstoryPrompt(character: Character) {
    return outdent`
      ${this.generateKnownCharacterInfo(character)}

      Now, write a backstory describing the character's history. The backstory
      should be a single paragraph in length.

      Follow the following style notes:
        - Your backstory should be evocative, but not overly poetic.

      Character's backstory: 
    `;
  }

  generateGoalsPrompt(character: Character) {
    const prompt = outdent`
      You are going to write a set of three goals that a character in a fantasy
      roleplaying campaign setting has. You should seek to describe goals that
      are creative, distinct, and dynamic, and that will lead to interesting
      roleplaying opportunities.

      ${
        character.originStatement
          ? `Use the following information when creating your response. The character is ${character.originStatement}.`
          : ``
      }

      The character is a ${character.species} named ${character.name} who is 
      ${character.age} years old.

      Physical description of the character: ${character.physicalDescription}

      Character's backstory: ${character.backstory}

      Write a set of three goals for the character. Each goal should be a single
      sentence in length.

      Output your response as JSON, in the following format:
      ["{GOAL 1}", "{GOAL 2}", "{GOAL 3}"]

      Examples:
      Uncover the ancient secrets of Xanthoria and understand its connection to the gods.
      Unravel the cryptic prophecy foretelling a cataclysmic event that could bring about the end of an ancient civilization.
      To find a true love that can break the cycle of misfortune that has plagued them for generations.

      Goals for the character:
    `;

    return prompt;
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

  generate(character: Character, field: keyof Character) {
    switch (field) {
      case "physicalDescription":
        return this.generatePhysicalDescriptionPrompt(character);

      case "backstory":
        return this.generateBackstoryPrompt(character);

      case "age":
        return this.generateAgePrompt(character);

      case "name":
        return this.generateNamePrompt(character);

      case "species":
        return this.generateSpeciesPrompt(character);
    }

    throw new Error("Invalid field");
  }
}
