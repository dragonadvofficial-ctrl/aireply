import OpenAI from "openai";
import { env, must } from "../env";

let client: OpenAI | null = null;
export function ai(): OpenAI {
  return (client ??= new OpenAI({ apiKey: must("OPENAI_API_KEY"), maxRetries: 2, timeout: 30_000 }));
}
export const aiEnabled = () => Boolean(env.OPENAI_API_KEY);
