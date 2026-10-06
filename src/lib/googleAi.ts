import { createGoogleGenerativeAI } from '@ai-sdk/google';

function resolveGoogleApiKey(): string {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      'Missing Google Gemini API key. Set GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY in .env.local (local) or Vercel Environment Variables (production).',
    );
  }

  return apiKey;
}

export function getGoogleGenerativeAI() {
  return createGoogleGenerativeAI({
    apiKey: resolveGoogleApiKey(),
  });
}
