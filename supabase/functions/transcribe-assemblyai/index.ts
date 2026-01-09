import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioUrl } = await req.json();
    
    if (!audioUrl) {
      throw new Error('audioUrl is required');
    }

    const ASSEMBLYAI_API_KEY = Deno.env.get('ASSEMBLYAI_API_KEY');
    if (!ASSEMBLYAI_API_KEY) {
      throw new Error('ASSEMBLYAI_API_KEY not configured');
    }

    console.log('Starting transcription for URL:', audioUrl);

    // Step 1: Submit the audio URL for transcription
    const submitResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: 'pt',
        speaker_labels: true,
      }),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      console.error('AssemblyAI submit error:', submitResponse.status, errorText);
      throw new Error(`Failed to submit transcription: ${errorText}`);
    }

    const submitData = await submitResponse.json();
    const transcriptId = submitData.id;
    console.log('Transcription submitted, ID:', transcriptId);

    // Step 2: Poll for completion
    let transcriptResult = null;
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max (5s * 120)

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'Authorization': ASSEMBLYAI_API_KEY,
        },
      });

      if (!pollResponse.ok) {
        const errorText = await pollResponse.text();
        console.error('AssemblyAI poll error:', pollResponse.status, errorText);
        throw new Error(`Failed to poll transcription: ${errorText}`);
      }

      const pollData = await pollResponse.json();
      console.log('Poll attempt', attempts + 1, '- Status:', pollData.status);

      if (pollData.status === 'completed') {
        transcriptResult = pollData;
        break;
      } else if (pollData.status === 'error') {
        throw new Error(`Transcription failed: ${pollData.error}`);
      }

      attempts++;
    }

    if (!transcriptResult) {
      throw new Error('Transcription timeout - file too large or processing too slow');
    }

    // Format the transcription with speaker labels if available
    let formattedText = '';
    
    if (transcriptResult.utterances && transcriptResult.utterances.length > 0) {
      formattedText = transcriptResult.utterances
        .map((u: any) => `[Speaker ${u.speaker}]: ${u.text}`)
        .join('\n\n');
    } else {
      formattedText = transcriptResult.text || '';
    }

    console.log('Transcription completed successfully');

    return new Response(JSON.stringify({ 
      text: formattedText,
      duration: transcriptResult.audio_duration,
      words: transcriptResult.words?.length || 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
