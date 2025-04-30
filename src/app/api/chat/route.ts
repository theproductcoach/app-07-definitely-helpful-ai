import { OpenAI } from 'openai';
import { NextRequest } from 'next/server';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    // Create stream from OpenAI
    const stream = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      stream: true,
    });

    // Create a readable stream to return to the client
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Error processing request';
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
} 