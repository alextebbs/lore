import {
  createParser,
  type ParsedEvent,
  type ReconnectInterval,
} from "eventsource-parser";

import { env } from "~/env.mjs";

export type ChatGPTAgent = "user" | "system";

export interface ChatGPTMessage {
  role: ChatGPTAgent;
  content: string;
}

export interface OpenAIStreamPayload {
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

export interface CustomOpenAIResponseType {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: CustomOpenAIMessageType[];
}

export interface CustomOpenAIMessageType {
  index: number;
  finish_reason: string | null;
  delta: {
    content: string;
  };
}

export async function OpenAIStream(payload: OpenAIStreamPayload) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let counter = 0;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
            const json = JSON.parse(data) as CustomOpenAIResponseType;

            const text = json.choices[0]?.delta.content || "";

            if (counter < 2 && (text.match(/\n/) || []).length) {
              // this is a prefix character (i.e., "\n\n"), do nothing
              return;
            }

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const chunk of res.body as any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        parser.feed(decoder.decode(chunk));
      }
    },
  });

  return stream;
}
