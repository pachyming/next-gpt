"use client";

import { encode } from "@nem035/gpt-3-encoder";
import { useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Chat {
  user: string;
  prompt: string;
}

const MAX_TOKEN = 4096;

export default function HomeClient() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);

  const generate = async (promptText: string) => {
    setLoading(true);
    setChats((_chats) => {
      return [
        ..._chats,
        { user: "user", prompt: prompt },
        { user: "bot", prompt: "..." },
      ];
    });

    /**
     * To give context to the API
     */
    const assistances = chats
      /**
       * @TODO not sure to include user chats as well to the payload...
       */
      // .filter((_chat) => _chat.user === "bot")
      .map((_chat) => {
        return {
          role: _chat.user === "bot" ? "assistant" : "user",
          content: _chat.prompt,
        };
      });
    let payload = [
      ...assistances,
      {
        role: "user",
        content: promptText,
      },
    ];

    let tokenOk = false;
    let finalPayload = [];

    let tokenCount = 0;
    for (let i = payload.length - 1; i >= 0; i--) {
      tokenCount += encode(payload[i].content).length;
      tokenOk = tokenCount < MAX_TOKEN;
      if (tokenOk) {
        finalPayload.push(payload[i]);
      } else {
        console.warn("Token limit reached: ", tokenCount);
        break;
      }
    }
    finalPayload.reverse();

    try {
      const response = await fetch("/api/gpt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: finalPayload,
        }),
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      // This data is a ReadableStream
      const data = response.body;
      if (!data) {
        return;
      }

      const reader = data.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value);

        setChats((_chats) => {
          let lastChat = { ..._chats[_chats.length - 1] };
          if (lastChat.prompt === "...") {
            lastChat.prompt = "";
          }
          lastChat.prompt += chunkValue;
          return [..._chats.slice(0, _chats.length - 1), lastChat];
        });
        window.scrollTo(0, document.body.scrollHeight);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = useCallback((e: any) => {
    setPrompt(e.target.value);
  }, []);

  const handleSubmit = useCallback(
    (e: any) => {
      e.preventDefault();
      generate(prompt);
    },
    [prompt]
  );

  return (
    <div className="flex flex-col mb-16">
      <h1 className="font-extrabold text-transparent text-4xl bg-clip-text bg-gradient-to-r from-cyan-400 to-green-600">
        ChatGPT
      </h1>

      <div className="my-5">
        {chats.map((chat, i) => (
          <div
            className={`px-3 py-2 rounded ${
              chat.user === "bot"
                ? "bg-gray-800 text-gray-300 mt-0"
                : "bg-gray-900 mt-3"
            }`}
            key={i}
          >
            <ReactMarkdown children={chat.prompt} remarkPlugins={[remarkGfm]} />
          </div>
        ))}
      </div>
      <form noValidate onSubmit={handleSubmit}>
        <div className="flex justify-center align-center fixed mb-10 bottom-2 left-0 right-0">
          <textarea
            className="px-4 py-3 h-12 max-h-12 w-2/4 rounded"
            placeholder="Input your prompt"
            onChange={handleChange}
            value={prompt}
            disabled={loading}
          ></textarea>
          <button
            type="submit"
            className="px-5 py-0 bg-gray-800 font-bold rounded text-2xl hover:bg-gray-700 disabled:bg-gray-600"
            disabled={loading}
          >
            {">"}
          </button>
        </div>
      </form>
    </div>
  );
}
