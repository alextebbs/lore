import { getOpenAIResponse } from "~/utils/openai";
import { outdent } from "outdent";

import { type Character } from "@prisma/client";

export class CharacterGenerator {
  async generateBaseInfo(character: Character) {
    console.log("Begin generating base info for character");

    const prompt = outdent`
      You are going to help create a character for use in a fantasy roleplaying
      campaign setting. You should seek to create characters that are creative,
      distinct, and dynamic. 

      First, determine the character's species. Choose from the following
      options. If the species has a subspecies, select a subspecies as well.

      Second, give the character a name.

      Third, give the character an age.

      ${
        character.originStatement
          ? `Use the following information when creating your response.
             {{Character}} is ${character.originStatement}.`
          : ``
      }

      Output your response in the following format: [Species/Subspecies], [Name], [Age]
    `;
    const baseInfo = await getOpenAIResponse(prompt);

    if (!baseInfo) {
      throw new Error("Failed to generate base info");
    }

    const [species, name, age] = baseInfo.split(", ");

    if (!species || !name || !age) {
      throw new Error("Failed to parse base info response from OpenAI");
    }

    character.name = name;
    character.age = parseInt(age);
    character.species = species;

    console.log("Generated base info for character");

    return character;
  }

  async generatePhysicalDescription(character: Character) {
    console.log("Begin generating physical description for character");

    const prompt = outdent`
      You are going to help create a character for use in a fantasy roleplaying
      campaign setting. You should seek to create characters that are creative,
      distinct, and dynamic. 

      Write a single paragraph description of the character's physical
      appearance, noting something that is unique, distinct, and memorable about
      their physical form. character description should be 1-2 sentences long.

      Follow the following style notes:
        - Your description should be evocative, but not overly poetic.
        - Describe only the physical appearance, not behavior or demeanor.
        - Use the present tense at all times.
        - Do not include newline characters in your response.

      ${
        character.originStatement
          ? `Use the following information when creating your response.
             {{Character}} is ${character.originStatement}.`
          : ``
      }

      The character is a ${character.species} named ${character.name} who is 
      ${character.age} years old.

      Physical description of {{Character}}: 
    `;

    const physicalDescription = await getOpenAIResponse(prompt);

    if (!physicalDescription) {
      throw new Error("Failed to generate physical description");
    }

    character.physicalDescription = physicalDescription;

    console.log("Generated physical description for character");

    return character;
  }

  async generateBackstory(character: Character) {
    console.log("Begin generating backstory for character");

    const prompt = outdent`
      You are going to write a character backstory for use in a fantasy
      roleplaying campaign setting. You should seek to write backstories
      characters that are creative, distinct, and dynamic. 

      Write a backstory describing the character's history. The backstory should
      be at least three paragraphs in length.

      Follow the following style notes:
        - Your backstory should be evocative, but not overly poetic.

      ${
        character.originStatement
          ? `Use the following information when creating your response. {{Character}} is ${character.originStatement}.`
          : ``
      }

      The character is a ${character.species} named ${character.name} who is 
      ${character.age} years old.

      Physical description of {{Character}}: ${character.physicalDescription}

      Character's backstory: 
    `;

    const backstory = await getOpenAIResponse(prompt);

    if (!backstory) {
      throw new Error("Failed to generate physical description");
    }

    character.backstory = backstory;

    console.log("Generated backstory for character");

    return character;
  }

  complete(character: Character) {
    character.finishedGeneration = true;
    return character;
  }

  async generateAll(character: Character) {
    character = await this.generateBaseInfo(character);
    character = await this.generatePhysicalDescription(character);
    character = await this.generateBackstory(character);

    return character;
  }
}
