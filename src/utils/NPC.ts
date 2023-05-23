import { getOpenAIResponse } from "~/utils/openai";
import { outdent } from "outdent";

export interface INPC {
  originStatement?: string;
  name?: string;
  age?: number;
  physicalDescription?: string;
  backstory?: string;
  relationships?: INPC[];
}

export class NPC {
  originStatement?: string;
  underConstruction?: boolean;
  name?: string;
  age?: number;
  species?: string;
  physicalDescription?: string;
  backstory?: string;
  relationships?: INPC[];

  constructor(npc: INPC) {
    this.originStatement = npc.originStatement;
    this.underConstruction = true;
  }

  async generateBaseInfo() {
    const prompt = outdent`
      You are going to help create a character for use in a fantasy roleplaying
      campaign setting. You should seek to create characters that are creative,
      distinct, and dynamic. 

      First, determine the character's species. Choose from the following
      options. If the species has a subspecies, select a subspecies as well.

      Second, give the character a name.

      Third, give the character an age.

      ${
        this.originStatement
          ? `Use the following information when creating your response.
             {{Character}} is ${this.originStatement}.`
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

    this.name = name;
    this.age = parseInt(age);
    this.species = species;
  }

  async generatePhysicalDescription() {
    const prompt = outdent`
      You are going to help create a character for use in a fantasy roleplaying
      campaign setting. You should seek to create characters that are creative,
      distinct, and dynamic. 

      Write a single paragraph description of the character's physical
      appearance, noting something that is unique, distinct, and memorable about
      their physical form. This description should be 1-2 sentences long.

      Follow the following style notes:
        - Your description should be evocative, but not overly poetic.
        - Describe only the physical appearance, not behavior or demeanor.
        - Use the present tense at all times.
        - Do not include newline characters in your response.

      ${
        this.originStatement
          ? `Use the following information when creating your response.
             {{Character}} is ${this.originStatement}.`
          : ``
      }

      The character is a ${this.species} named ${this.name} who is 
      ${this.age} years old.

      Physical description of {{Character}}: 
    `;

    this.physicalDescription = await getOpenAIResponse(prompt);
  }

  async generateBackstory() {
    const prompt = outdent`
      You are going to write a character backstory for use in a fantasy
      roleplaying campaign setting. You should seek to write backstories
      characters that are creative, distinct, and dynamic. 

      Write a backstory describing the character's history. The backstory should
      be at least three paragraphs in length.

      Follow the following style notes:
        - Your backstory should be evocative, but not overly poetic.

      ${
        this.originStatement
          ? `Use the following information when creating your response. {{Character}} is ${this.originStatement}.`
          : ``
      }

      The character is a ${this.species} named ${this.name} who is 
      ${this.age} years old.

      Physical description of {{Character}}: ${this.physicalDescription}

      Character's backstory: 
    `;

    this.backstory = await getOpenAIResponse(prompt);
  }

  async generateAll() {
    await this.generateBaseInfo();
    await this.generatePhysicalDescription();
    await this.generateBackstory();
    this.underConstruction = false;
  }
}
