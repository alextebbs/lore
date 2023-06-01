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
             The character is ${character.originStatement}.`
          : ``
      }

      Output your response in the following format: [Species/Subspecies], [Name], [Age]
    `;

    try {
      const baseInfo = await getOpenAIResponse(prompt);

      if (!baseInfo) {
        throw new Error("Failed to generate base info");
      }

      const [species, name, age] = baseInfo.split(", ");

      if (!species || !name || !age) {
        throw new Error("Failed to parse base info response from OpenAI");
      }

      character.name = name;
      character.age = age;
      character.species = species;

      console.log("Generated base info for character");
    } catch (e: unknown) {
      console.log("Error during base info generation");

      if (e instanceof Error) {
        console.log(e.message);
        character.name = e.message;
        character.age = e.message;
        character.species = e.message;
      }
    }

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
             The character is ${character.originStatement}.`
          : ``
      }

      The character is a ${character.species} named ${character.name} who is 
      ${character.age} years old.

      Physical description of ${character.name}:
    `;

    try {
      const physicalDescription = await getOpenAIResponse(prompt);

      if (!physicalDescription) {
        throw new Error("Failed to generate physical description");
      }

      character.physicalDescription = physicalDescription;

      console.log("Generated physical description for character");
    } catch (e: unknown) {
      console.log("Error during physical description generation");

      if (e instanceof Error) {
        console.log(e.message);
        character.physicalDescription = e.message;
      }
    }

    return character;
  }

  async generatePhysicalSpecs(character: Character) {
    console.log("Begin generating physical info for character");

    const prompt = outdent`
      Given the following description of a character's physical appearance, 
      determine the character's height, weight, eye color, and hair color.

      The character is a ${character.species} named ${character.name} who is 
      ${character.age} years old.

      The character is ${character.originStatement}.

      Physical description of the character: ${character.physicalDescription}

      Follow the following style notes:
        - Generate height in feet and inches, and output like so: 5'10"
        - Generate weight in pounds, and output like so: 150lbs
        - Generate eye color as a single word, and output like so: Blue
        - Generate hair color as a single word, and output like so: Brown

      Output your response in the following format: 
      [Height], [Weight], [Eye Color], [Hair Color]
    `;

    try {
      const physicalSpecs = await getOpenAIResponse(prompt);

      if (!physicalSpecs) {
        throw new Error("Failed to generate physical info");
      }

      const [height, weight, eyeColor, hairColor] = physicalSpecs.split(", ");

      if (!height || !weight || !eyeColor || !hairColor) {
        throw new Error("Failed to parse physical info response from OpenAI");
      }

      character.height = height;
      character.weight = weight;
      character.eyeColor = eyeColor;
      character.hairColor = hairColor;

      console.log("Generated physical info for character");
    } catch (e: unknown) {
      console.log("Error during physical info generation");

      if (e instanceof Error) {
        console.log(e.message);
        character.height = e.message;
        character.weight = e.message;
        character.eyeColor = e.message;
        character.hairColor = e.message;
      }
    }

    return character;
  }

  async generateBackstory(character: Character) {
    console.log("Begin generating backstory for character");

    const prompt = outdent`
      You are going to write a character backstory for use in a fantasy
      roleplaying campaign setting. You should seek to write backstories
      characters that are creative, distinct, and dynamic. 

      Write a backstory describing the character's history. The backstory should
      be a single paragraph in length.

      Follow the following style notes:
        - Your backstory should be evocative, but not overly poetic.

      ${
        character.originStatement
          ? `Use the following information when creating your response. The character is ${character.originStatement}.`
          : ``
      }

      The character is a ${character.species} named ${character.name} who is 
      ${character.age} years old.

      Physical description of the character: ${character.physicalDescription}

      Character's backstory: 
    `;

    try {
      const backstory = await getOpenAIResponse(prompt);

      if (!backstory) {
        throw new Error("Failed to generate backstory");
      }

      character.backstory = backstory;

      console.log("Generated backstory for character");
    } catch (e: unknown) {
      console.log("Error during backstory generation");

      if (e instanceof Error) {
        console.log(e.message);
        character.backstory = e.message;
      }
    }

    return character;
  }

  async generateGoals(character: Character) {
    console.log("Begin generating goals for character");

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

    try {
      const goals = await getOpenAIResponse(prompt);

      if (!goals) {
        throw new Error("Failed to generate goals");
      }

      character.goals = goals;

      console.log("Generated goals for character");
    } catch (e: unknown) {
      console.log("Error during goals generation");

      if (e instanceof Error) {
        console.log(e.message);
        character.goals = e.message;
      }
    }

    return character;
  }

  complete(character: Character) {
    character.finishedGeneration = true;
    return character;
  }

  // QUESTION
  // I guess I need this to map the field string (which comes from the URL) to
  // the correct method. Is there a better way to do this?
  async generate(character: Character, field: string) {
    switch (field) {
      case "baseInfo":
        character = await this.generateBaseInfo(character);
        break;

      case "physicalDescription":
        character = await this.generatePhysicalDescription(character);
        break;

      case "physicalSpecs":
        character = await this.generatePhysicalSpecs(character);
        break;

      case "backstory":
        character = await this.generateBackstory(character);
        break;

      case "goals":
        character = await this.generateGoals(character);
        break;
    }

    return character;
  }

  async generateAll(character: Character) {
    character = await this.generateBaseInfo(character);
    character = await this.generatePhysicalDescription(character);
    character = await this.generateBackstory(character);
    character = this.complete(character);

    return character;
  }
}
