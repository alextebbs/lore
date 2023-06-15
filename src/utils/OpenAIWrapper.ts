// Code in this file taken from the following sources:
// 1. https://levelup.gitconnected.com/how-to-stream-real-time-openai-api-responses-next-js-13-2-gpt-3-5-turbo-and-edge-functions-378fea4dadbd
// 2. https://vercel.com/blog/gpt-3-app-next-js-vercel-edge-functions

// This file is kind of a mess, I think if I'm going to refactor it much
// more I need to understand more about ReadableStreams and how they work

import {
  createParser,
  type ParsedEvent,
  type ReconnectInterval,
} from "eventsource-parser";

import { env } from "~/env.mjs";

type ChatGPTAgent = "user" | "system";

interface ChatGPTMessage {
  role: ChatGPTAgent;
  content: string;
}

interface OpenAIStreamPayload {
  model: string;
  messages: ChatGPTMessage[];
  temperature: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  max_tokens: number;
  stream: boolean;
  n: number;
}

interface CustomOpenAIStreamingResponseType {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: CustomOpenAIStreamingMessageType[];
}

interface CustomOpenAIStreamingMessageType {
  index: number;
  finish_reason: string | null;
  delta: {
    content: string;
  };
}

interface CustomOpenAIResponseType {
  id: string;
  object: string;
  created: number;
  model: string;
  usage: {
    prompt_toekns: number;
    completion_tokens: number;
    total_tokens: number;
  };
  choices: CustomOpenAIMessageType[];
}

interface CustomOpenAIMessageType {
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
  index: number;
}

async function OpenAIStream(payload: OpenAIStreamPayload) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let counter = 0;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY ?? ""}`,
    },
    method: "POST",
    body: JSON.stringify(payload),
  });

  const stream = new ReadableStream({
    async start(controller) {
      // callback
      function onParse(event: ParsedEvent | ReconnectInterval) {
        if (event.type === "event") {
          const data = event.data;

          // https://beta.openai.com/docs/api-reference/completions/create#completions/create-stream
          if (data === "[DONE]") {
            controller.close();
            return;
          }

          try {
            // NOTE: I had to make this custom type because the OpenAI API response is not typed correctly.
            const json = JSON.parse(data) as CustomOpenAIStreamingResponseType;

            const text = json.choices[0]?.delta.content || "";

            // Skip over prefix characters
            if (counter < 2 && (text.match(/\n/) || []).length) return;

            const queue = encoder.encode(text);
            controller.enqueue(queue);
            counter++;
          } catch (e) {
            // maybe parse error
            controller.error(e);
          }
        }
      }

      // stream response (SSE) from OpenAI may be fragmented into multiple chunks
      // this ensures we properly read chunks and invoke an event for each SSE event stream
      const parser = createParser(onParse);
      // https://web.dev/streams/#asynchronous-iteration

      // QUESTION: How do I know what type "chunk" is actually supposed to be?
      // I think its a Uint8Array, but I can't figure out how to type it exactly.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const chunk of response.body as any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        parser.feed(decoder.decode(chunk));
      }
    },
  });

  return stream;
}

interface GetOpenAIResponseOptions {
  prompt: string;
  stream?: boolean;
}

/**
 * Helper function to call the OpenAI API. Will return either a stream or a
 * promise for a string depending on the value of the `stream` parameter.
 *
 * @param options Options for the OpenAI API call
 */
export async function getOpenAIResponse(options: GetOpenAIResponseOptions) {
  const { prompt, stream = true } = options;

  const payload: OpenAIStreamPayload = {
    stream: stream,
    temperature: 1,
    max_tokens: 2048,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    model: "gpt-3.5-turbo",
    n: 1,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  };

  if (!stream) {
    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY ?? ""}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const json = (await response.json()) as CustomOpenAIResponseType;

      if (json?.choices[0]?.message?.content) {
        return json.choices[0].message?.content.trim();
      } else {
        console.log("Unexpected response format");
        return "Failed to generate";
      }
    } catch (err) {
      console.log("Other failure in OpenAI API call");
      console.log(err);
      return "Failed to generate";
    }
  } else {
    const readableStream = await OpenAIStream(payload);
    return readableStream;
  }
}
