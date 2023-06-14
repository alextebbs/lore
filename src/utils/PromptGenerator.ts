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
        character.demeanor ? `Character's demeanor: ${character.demeanor}.` : ``
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

      Now, generate a ${regenPrompt ? "new" : ""} species or the character.
      Choose from the following options. If the species has a subspecies, select
      a subspecies as well.

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

      Now, generate a ${regenPrompt ? "new" : ""} age for the character. 

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

      Now, generate a ${regenPrompt ? "new" : ""} name for the character. 

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

      Now, write a ${regenPrompt ? "new" : ""} single paragraph description of
      the character's physical appearance, noting something that is unique,
      distinct, and memorable about their physical form. This description should
      be 1-2 sentences long.

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

      Now, write a ${regenPrompt ? "new" : ""} single paragraph description of
      the character's behavior and demeanor, noting something that is unique,
      distinct, and memorable about their presence, speaking style, or
      mannerisms. This description should be 1-2 sentences long.

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

      Now, write a ${regenPrompt ? "new" : ""} backstory describing the
      character's history. The backstory should be a single paragraph in length.

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

  generateGoalsPrompt(character: Character, regenPrompt: string | null = null) {
    return outdent`
      ${this.generateKnownCharacterInfo(character)}

      Now, write a list of three primary goals that the character has. These goals should
      relate to the character's backstory and history.

      Output each goal as a single sentence of text, prepended with a dash and separated
      by a newline. Goals should be written in the third person.

      Examples:
      - To become the greatest warrior in the land.
      - To find the lost treasure of the ancient kingdom.
      - To avenge the death of their father.

      ${
        regenPrompt
          ? `Use the following instruction when generating a response: ${regenPrompt}`
          : ``
      }

      Character's goals:
    `;
  }

  generateFriendsPrompt(
    character: Character,
    regenPrompt: string | null = null
  ) {
    return outdent`
      ${this.generateKnownCharacterInfo(character)}

      Now, write a list of three friendly relationships this character has with
      other characters or factions. Use one paragraph for these descriptions.
      Describe how the character made this relationship, why they are friendly,
      and one recent event or interaction that might threaten this relationship.

      Output each relationship as a single paragraph of text, prepended with a
      dash and separated by a newline.

      ${
        regenPrompt
          ? `Use the following instruction when generating a response: ${regenPrompt}`
          : ``
      }

      Character's friends: 
    `;
  }

  generateEnemiesPrompt(
    character: Character,
    regenPrompt: string | null = null
  ) {
    return outdent`
      ${this.generateKnownCharacterInfo(character)}

      Now, write a list of three enemy relationships this character has with
      other characters or factions. Use one paragraph for these descriptions.
      Describe how the character made this relationship, why they are friendly,
      and one recent event or interaction that might lead to a resolution of
      their grudges.

      Output each relationship as a single paragraph of text, prepended with a
      dash and separated by a newline.

      ${
        regenPrompt
          ? `Use the following instruction when generating a response: ${regenPrompt}`
          : ``
      }

      Character's enemies: 
    `;
  }

  generateSecretPrompt(
    character: Character,
    regenPrompt: string | null = null
  ) {
    return outdent`
      ${this.generateKnownCharacterInfo(character)}

      Now, write one secret about the character. This could represent something
      they are ashamed about, a flaw, or hidden knowledge they have access to.

      ${
        regenPrompt
          ? `Use the following instruction when generating a response: ${regenPrompt}`
          : ``
      }

      Character's secret: 
    `;
  }

  generateRoleplayTipsPrompt(
    character: Character,
    regenPrompt: string | null = null
  ) {
    return outdent`
      ${this.generateKnownCharacterInfo(character)}

      Now, write a short guide with tips for an actor that might roleplay as this
      character. This should be a single paragraph in length.

      ${
        regenPrompt
          ? `Use the following instruction when generating a response: ${regenPrompt}`
          : ``
      }

      Character's roleplaying tips: 
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
    if (regenerate) {
      character = { ...character, [field]: null };
    }

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

      case "goals":
        return this.generateGoalsPrompt(character, regenPrompt);

      case "friends":
        return this.generateFriendsPrompt(character, regenPrompt);

      case "enemies":
        return this.generateEnemiesPrompt(character, regenPrompt);

      case "secret":
        return this.generateSecretPrompt(character, regenPrompt);

      case "roleplayTips":
        return this.generateRoleplayTipsPrompt(character, regenPrompt);
    }

    throw new Error("Invalid field");
  }
}
