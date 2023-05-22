import { Configuration, OpenAIApi } from "openai";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export async function getOpenAIResponse(
  prompt: string,
  temperature = 1,
  max_tokens = 2048,
  model = "text-davinci-003"
) {
  try {
    const response = await openai.createCompletion({
      model,
      prompt,
      temperature,
      max_tokens,
    });
    console.log(prompt);
    return response.data.choices[0].text;
  } catch (err) {
    console.log(err);
  }
}
