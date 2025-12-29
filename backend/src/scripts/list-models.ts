
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load env vars
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
        console.error('No API key found!');
        process.exit(1);
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    console.log('Fetching models from:', url.replace(apiKey, 'API_KEY'));

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
        }
        const data = await response.json() as any;

        if (data.models) {
            const models = data.models.filter((m: any) => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'));
            const outputPath = path.resolve(__dirname, '../../models.json');
            fs.writeFileSync(outputPath, JSON.stringify(models.map((m: any) => m.name), null, 2));
            console.log(`Saved ${models.length} models to ${outputPath}`);
        } else {
            console.log('No models found in response:', data);
        }
    } catch (error: any) {
        console.error('Error fetching models:', error);
    }
}

listModels();
