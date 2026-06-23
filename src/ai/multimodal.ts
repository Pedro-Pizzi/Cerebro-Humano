import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Audio Transcription (Whisper)
export async function transcribeAudio(audioBuffer: Buffer, mimetype: string): Promise<string | null> {
    try {
        const ext = mimetype.split('/')[1] || 'ogg';
        const tempFilePath = path.join(process.cwd(), `temp_audio_${Date.now()}.${ext}`);
        fs.writeFileSync(tempFilePath, audioBuffer);
        
        const response = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: 'whisper-1',
            language: 'pt'
        });
        
        fs.unlinkSync(tempFilePath);
        return response.text;
    } catch (err) {
        console.error('[Audio] Erro ao transcrever:', err);
        return null;
    }
}

// Vision (GPT-4 Vision)
export async function describeImage(base64Image: string, mimetype: string): Promise<string | null> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // gpt-4o-mini supports vision
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Descreva esta imagem de forma curta e objetiva, focando nos elementos principais para que outra pessoa consiga entender o que foi enviado." },
                        {
                            type: "image_url",
                            image_url: {
                                "url": `data:${mimetype};base64,${base64Image}`,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 300,
        });
        
        return response.choices[0].message.content;
    } catch (err) {
        console.error('[Vision] Erro ao descrever imagem:', err);
        return null;
    }
}
