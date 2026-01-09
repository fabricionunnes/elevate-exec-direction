import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Refresh Google access token if expired
async function refreshGoogleToken(supabase: any, userId: string, refreshToken: string): Promise<string | null> {
  const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
  const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
  
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('Google credentials not configured');
    return null;
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      console.error('Failed to refresh token:', await response.text());
      return null;
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + (data.expires_in * 1000)).toISOString();
    
    // Update stored token in user_google_tokens
    await supabase
      .from('user_google_tokens')
      .update({
        access_token: data.access_token,
        token_expires_at: expiresAt,
      })
      .eq('user_id', userId);

    return data.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

// Get direct download URL from Google Drive using API
async function getGoogleDriveDownloadUrl(fileId: string, accessToken: string): Promise<string> {
  // First, get file metadata to check if it's accessible
  const metadataResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!metadataResponse.ok) {
    const error = await metadataResponse.text();
    console.error('Drive metadata error:', error);
    throw new Error('Não foi possível acessar o arquivo no Google Drive. Verifique se você tem permissão.');
  }

  const metadata = await metadataResponse.json();
  console.log('File metadata:', metadata);

  // Use the download endpoint with access token
  // This returns a temporary URL that AssemblyAI can access
  const downloadResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      redirect: 'manual', // Don't follow redirects
    }
  );

  // Google Drive returns a 307 redirect to the actual download URL
  if (downloadResponse.status === 307 || downloadResponse.status === 302) {
    const redirectUrl = downloadResponse.headers.get('Location');
    if (redirectUrl) {
      console.log('Got redirect URL for download');
      return redirectUrl;
    }
  }

  // If no redirect, we need to upload the file to AssemblyAI directly
  // because the API access doesn't give a public URL
  console.log('No redirect, will upload to AssemblyAI directly');
  return `UPLOAD_NEEDED:${fileId}`;
}

// Upload file directly to AssemblyAI
async function uploadToAssemblyAI(fileId: string, accessToken: string, assemblyApiKey: string): Promise<string> {
  console.log('Downloading file from Google Drive...');
  
  const downloadResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!downloadResponse.ok) {
    throw new Error('Falha ao baixar arquivo do Google Drive');
  }

  const audioData = await downloadResponse.arrayBuffer();
  console.log('Downloaded', audioData.byteLength, 'bytes');

  console.log('Uploading to AssemblyAI...');
  const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: {
      'Authorization': assemblyApiKey,
      'Content-Type': 'application/octet-stream',
    },
    body: audioData,
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    console.error('AssemblyAI upload error:', error);
    throw new Error('Falha ao fazer upload para AssemblyAI');
  }

  const uploadData = await uploadResponse.json();
  console.log('Upload complete, URL:', uploadData.upload_url);
  return uploadData.upload_url;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioUrl, staffId } = await req.json();
    
    if (!audioUrl) {
      throw new Error('audioUrl is required');
    }

    const ASSEMBLYAI_API_KEY = Deno.env.get('ASSEMBLYAI_API_KEY');
    if (!ASSEMBLYAI_API_KEY) {
      throw new Error('ASSEMBLYAI_API_KEY not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let finalAudioUrl = audioUrl;

    // Check if it's a Google Drive link
    const driveMatch = audioUrl.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    const driveOpenMatch = audioUrl.match(/drive\.google\.com\/open\?id=([^&]+)/);
    const fileId = driveMatch?.[1] || driveOpenMatch?.[1];

    if (fileId && staffId) {
      console.log('Google Drive file detected, ID:', fileId);
      
      // Get staff's user_id first
      const { data: staff } = await supabase
        .from('onboarding_staff')
        .select('user_id')
        .eq('id', staffId)
        .single();

      if (!staff?.user_id) {
        throw new Error('Staff não encontrado.');
      }

      // Get Google tokens from user_google_tokens table
      const { data: tokenData } = await supabase
        .from('user_google_tokens')
        .select('access_token, refresh_token, token_expires_at')
        .eq('user_id', staff.user_id)
        .single();

      if (tokenData) {
        let accessToken = tokenData.access_token;

        // Check if token is expired
        const expiresAt = new Date(tokenData.token_expires_at).getTime();
        if (expiresAt < Date.now()) {
          console.log('Token expired, refreshing...');
          accessToken = await refreshGoogleToken(supabase, staff.user_id, tokenData.refresh_token);
        }

        if (accessToken) {
          try {
            const driveUrl = await getGoogleDriveDownloadUrl(fileId, accessToken);
            
            if (driveUrl.startsWith('UPLOAD_NEEDED:')) {
              // Need to download and re-upload to AssemblyAI
              finalAudioUrl = await uploadToAssemblyAI(fileId, accessToken, ASSEMBLYAI_API_KEY);
            } else {
              finalAudioUrl = driveUrl;
            }
          } catch (driveError) {
            console.error('Google Drive access error:', driveError);
            throw new Error('Não foi possível acessar o arquivo no Google Drive. Verifique as permissões do arquivo.');
          }
        } else {
          throw new Error('Sessão do Google expirada. Reconecte o Google Calendar nas configurações.');
        }
      } else {
        throw new Error('Google não conectado. Conecte o Google Calendar nas configurações para acessar arquivos do Drive.');
      }
    }

    console.log('Starting transcription for URL:', finalAudioUrl.substring(0, 100) + '...');

    // Step 1: Submit the audio URL for transcription
    const submitResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: finalAudioUrl,
        language_code: 'pt',
        speaker_labels: true,
      }),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      console.error('AssemblyAI submit error:', submitResponse.status, errorText);
      throw new Error(`Falha ao enviar para transcrição: ${errorText}`);
    }

    const submitData = await submitResponse.json();
    const transcriptId = submitData.id;
    console.log('Transcription submitted, ID:', transcriptId);

    // Step 2: Poll for completion
    let transcriptResult = null;
    let attempts = 0;
    const maxAttempts = 180; // 15 minutes max (5s * 180)

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
        throw new Error(`Falha ao verificar transcrição: ${errorText}`);
      }

      const pollData = await pollResponse.json();
      console.log('Poll attempt', attempts + 1, '- Status:', pollData.status);

      if (pollData.status === 'completed') {
        transcriptResult = pollData;
        break;
      } else if (pollData.status === 'error') {
        if (pollData.error?.includes('text/html') || pollData.error?.includes('HTML document')) {
          throw new Error('O arquivo não pôde ser acessado. Verifique se o arquivo está compartilhado corretamente no Google Drive.');
        }
        throw new Error(`Falha na transcrição: ${pollData.error}`);
      }

      attempts++;
    }

    if (!transcriptResult) {
      throw new Error('Tempo limite excedido - arquivo muito grande ou processamento muito lento');
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
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
