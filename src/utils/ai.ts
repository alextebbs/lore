import { Configuration, OpenAIApi } from "openai-edge";

import { env } from "~/env.mjs";

const apiConfig = new Configuration({
  apiKey: env.OPENAI_API_KEY,
});

export const openai = new OpenAIApi(apiConfig);
