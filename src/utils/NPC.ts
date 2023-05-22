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
  physicalDescription?: string;
  backstory?: string;
  relationships?: INPC[];

  constructor(npc: INPC) {
    this.originStatement = npc.originStatement;
    this.underConstruction = true;
  }

  async generatePhysicalDescription() {
    let prompt = outdent`
      You are going to help create a character for use in a fantasy roleplaying
      campaign setting. You should seek to create characters that are creative,
      distinct, and dynamic. 

      Write a single paragraph description of the character's physical appearance,
      noting something that is unique, distinct, and memorable about their physical
      form. This description should be 1-2 sentences long.

      Follow the following style notes:
        - Your description should be evocative, but not overly poetic.
        - Describe only the physical appearance, not behavior or demeanor.
        - Do not name the character. Use the placeholder name {{Character}} when
          referring to the Character by name.
        - Use the present tense at all times.
        - Do not include newline characters in your response.

      ${
        this.originStatement
          ? `Use the following information when creating your response. {{Character}} is ${this.originStatement}.`
          : ``
      }

      Physical description of {{Character}}: 
    `;
    this.physicalDescription = await getOpenAIResponse(prompt);
  }

  async generateBackstory() {
    let prompt = outdent`
      You are going to write a character backstory for use in a fantasy
      roleplaying campaign setting. You should seek to write backstories
      characters that are creative, distinct, and dynamic. 

      Write a backstory describing the character's history. The backstory should
      be at least three paragraphs in length.

      Follow the following style notes:
        - Your backstory should be evocative, but not overly poetic.
        - Do not name the character. Use the placeholder name {{Character}} when
          referring to the Character by name.
        - Do not include newline characters in your response.

      ${
        this.originStatement
          ? `Use the following information when creating your response. {{Character}} is ${this.originStatement}.`
          : ``
      }

      Physical description of {{Character}}: ${this.physicalDescription}

      Character's backstory: 
    `;
    this.backstory = await getOpenAIResponse(prompt);
  }

  async generateAll() {
    await this.generatePhysicalDescription();
    await this.generateBackstory();
    this.underConstruction = false;
  }
}
