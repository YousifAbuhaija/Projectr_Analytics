import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

async function main() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) { console.error('No GOOGLE_GEMINI_API_KEY'); process.exit(1); }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );
  const data = await res.json() as { models: Array<{ name: string; supportedGenerationMethods: string[] }> };

  const chat = data.models
    ?.filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => m.name.replace('models/', ''));

  console.log('Available models supporting generateContent:\n');
  chat?.forEach(m => console.log(' ', m));
}

main();
