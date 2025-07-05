import { Context } from "@netlify/edge-functions";

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8888',
  'https://web2grid.netlify.app'
];

export default async (req: Request, context: Context) => {
  console.log('Edge function called:', req.method, req.url);
  
  const origin = req.headers.get('origin');
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin!) ? origin! : '',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const apiKey = Deno.env.get('VITE_GEMINI_API_KEY');
  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  if (!apiKey) {
    console.error('API key not found');
    return new Response(JSON.stringify({ error: 'VITE_GEMINI_API_KEY is not set' }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (req.method !== 'POST') {
    console.log('Invalid method:', req.method);
    return new Response('Method Not Allowed', {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    console.log('Processing POST request');
    const requestBody = await req.json();
    const { modelId, ...geminiRequestBody } = requestBody;

    if (!modelId) {
      console.error('No modelId provided');
      return new Response(JSON.stringify({ error: 'modelId is required' }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log('Making request to Gemini API for model:', modelId);
    const geminiUrl = `${baseUrl}/${modelId}:streamGenerateContent?key=${apiKey}&alt=sse`;
    console.log('Gemini URL:', geminiUrl);
    console.log('Request body keys:', Object.keys(geminiRequestBody));
    
    const startTime = Date.now();
    
    // Add timeout to prevent hanging - longer timeout for streaming
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('Timeout reached, aborting request after 45 seconds');
      controller.abort();
    }, 45000); // 45 second timeout for streaming
    
    try {
      const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(geminiRequestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const fetchTime = Date.now() - startTime;
      console.log('Gemini API response status:', geminiResponse.status, 'in', fetchTime, 'ms');

      if (!geminiResponse.ok) {
        console.error('Gemini API error:', geminiResponse.status, geminiResponse.statusText);
        const errorText = await geminiResponse.text();
        console.error('Error details:', errorText);
        return new Response(JSON.stringify({ 
          error: 'Gemini API error', 
          status: geminiResponse.status,
          details: errorText
        }), {
          status: geminiResponse.status,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Check if response body exists
      if (!geminiResponse.body) {
        console.error('No response body from Gemini API');
        return new Response(JSON.stringify({ error: 'No response body from Gemini API' }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // FIXED: Stream the response directly without reading it first
      // This is the key - we pass the stream through without buffering
      console.log('Streaming response directly...');
      return new Response(geminiResponse.body, {
        status: geminiResponse.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const fetchTime = Date.now() - startTime;
      console.error('Fetch to Gemini API failed after', fetchTime, 'ms:', fetchError);
      console.error('Error name:', fetchError.name);
      console.error('Error message:', fetchError.message);
      
      if (fetchError.name === 'AbortError') {
        console.error('Request was aborted due to timeout');
        return new Response(JSON.stringify({ error: 'Request timeout after 45 seconds' }), {
          status: 408,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      
      throw fetchError;
    }

  } catch (error) {
    console.error('Error in gemini-proxy edge function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal Server Error',
      message: error.message,
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};