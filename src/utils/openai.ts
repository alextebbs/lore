import { Configuration, OpenAIApi } from "openai";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

/**
 * Helper function to call the OpenAI API.
 *
 * @param prompt The prompt to send to the API.
 * @param temperature The temperature to send to the API.
 * @param max_tokens The max_tokens to send to the API.
 * @param model The model to send to the API.
 */
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

    if (response?.data?.choices[0]?.text) {
      return response.data.choices[0].text.trim();
    } else {
      console.log("Unexpected response format");
      return "failed";
    }
  } catch (err) {
    console.log(err);
  }
}
