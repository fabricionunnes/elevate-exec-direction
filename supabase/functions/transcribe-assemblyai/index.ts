import { createClient } from "@supabase/supabase-js";

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

// Get file metadata and check access
async function getFileMetadata(fileId: string, accessToken: string): Promise<{ name: string; mimeType: string; size: number } | null> {
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
    console.error('Drive metadata error:', metadataResponse.status, error);
    return null;
  }

  const metadata = await metadataResponse.json();
  return {
    name: metadata.name,
    mimeType: metadata.mimeType,
    size: parseInt(metadata.size || '0', 10),
  };
}

// Get direct download URL from Google Drive using API
async function getGoogleDriveDownloadUrl(fileId: string, accessToken: string): Promise<string> {
  // First, get file metadata to check if it's accessible
  const metadata = await getFileMetadata(fileId, accessToken);
  
  if (!metadata) {
    throw new Error('Não foi possível acessar o arquivo no Google Drive. Verifique se você tem permissão.');
  }

  console.log('File metadata:', JSON.stringify(metadata));

  // Check file size - warn for large files
  const fileSizeMB = metadata.size / (1024 * 1024);
  console.log(`File size: ${fileSizeMB.toFixed(2)} MB`);
  
  if (fileSizeMB > 500) {
    console.warn(`Large file detected: ${fileSizeMB.toFixed(2)} MB - this may take a while`);
  }

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
  return `UPLOAD_NEEDED:${fileId}:${metadata.size}`;
}

// Upload file directly to AssemblyAI (streaming to avoid memory blowups)
async function uploadToAssemblyAI(fileId: string, accessToken: string, assemblyApiKey: string, fileSize?: number): Promise<string> {
  console.log('Downloading file from Google Drive...');

  // For very large files (>500MB), we need to handle this differently
  const fileSizeMB = fileSize ? fileSize / (1024 * 1024) : 0;
  if (fileSizeMB > 500) {
    console.log(`Processing large file: ${fileSizeMB.toFixed(2)} MB`);
  }

  const downloadResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!downloadResponse.ok) {
    const errorStatus = downloadResponse.status;
    const raw = await downloadResponse.text().catch(() => '');
    console.error('Google Drive download error:', errorStatus, raw.substring(0, 1000));

    // Try to parse Google error payload
    let googleReason: string | undefined;
    try {
      const parsed = JSON.parse(raw);
      googleReason = parsed?.error?.errors?.[0]?.reason;
    } catch {
      // ignore
    }

    if (errorStatus === 403) {
      if (googleReason === 'cannotDownloadFile') {
        throw new Error(
          'O Google Drive bloqueou o download deste arquivo (cannotDownloadFile). Normalmente isso acontece quando a gravação não pertence a esta conta Google ou quando o proprietário desativou “baixar/imprimir/copiar” para quem tem acesso. Use a conta Google dona da gravação (a mesma que organizou a reunião) ou peça ao proprietário para permitir download/baixar.'
        );
      }
      throw new Error('Acesso negado ao arquivo do Google Drive. Verifique se você tem permissão de download/visualização.');
    } else if (errorStatus === 404) {
      throw new Error('Arquivo não encontrado no Google Drive.');
    } else if (errorStatus === 401) {
      throw new Error('Sessão do Google expirada. Reconecte o Google nas configurações.');
    }

    throw new Error(`Falha ao baixar arquivo do Google Drive (${errorStatus})`);
  }

  if (!downloadResponse.body) {
    throw new Error('Falha ao baixar arquivo do Google Drive (stream indisponível)');
  }

  const contentLength = downloadResponse.headers.get('content-length');
  console.log('Streaming upload to AssemblyAI...', contentLength ? `(${(parseInt(contentLength) / (1024 * 1024)).toFixed(2)} MB)` : '(unknown size)');

  const uploadHeaders: Record<string, string> = {
    'Authorization': assemblyApiKey,
    'Content-Type': 'application/octet-stream',
  };
  if (contentLength) uploadHeaders['Content-Length'] = contentLength;

  try {
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: uploadHeaders,
      body: downloadResponse.body,
    });

    if (!uploadResponse.ok) {
      const errorStatus = uploadResponse.status;
      const error = await uploadResponse.text().catch(() => 'Unknown error');
      console.error('AssemblyAI upload error:', errorStatus, error.substring(0, 500));
      
      if (errorStatus === 413) {
        throw new Error('Arquivo muito grande para transcrição. Tente um arquivo menor que 500MB.');
      }
      
      throw new Error(`Falha ao fazer upload para AssemblyAI (${errorStatus})`);
    }

    const uploadData = await uploadResponse.json();
    console.log('Upload complete, URL:', uploadData.upload_url?.substring(0, 50) + '...');
    return uploadData.upload_url;
  } catch (uploadError) {
    console.error('Upload streaming error:', uploadError);
    throw new Error('Erro durante o upload do arquivo. O arquivo pode ser muito grande.');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioUrl, audio_base64, staffId, language_code } = await req.json();
    
    if (!audioUrl && !audio_base64) {
      throw new Error('audioUrl or audio_base64 is required');
    }

    const ASSEMBLYAI_API_KEY = Deno.env.get('ASSEMBLYAI_API_KEY');
    if (!ASSEMBLYAI_API_KEY) {
      throw new Error('ASSEMBLYAI_API_KEY not configured');
    }

    let finalAudioUrl = audioUrl || '';

    // If base64 audio is provided, upload it to AssemblyAI first
    if (audio_base64) {
      console.log('Uploading base64 audio to AssemblyAI...');
      
      // Decode base64 to binary
      const binaryString = atob(audio_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          'Authorization': ASSEMBLYAI_API_KEY,
          'Content-Type': 'application/octet-stream',
        },
        body: bytes,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('AssemblyAI upload error:', uploadResponse.status, errorText);
        throw new Error(`Falha ao fazer upload do áudio: ${errorText}`);
      }

      const uploadData = await uploadResponse.json();
      finalAudioUrl = uploadData.upload_url;
      console.log('Audio uploaded successfully');
    } else if (audioUrl) {
      // Check if it's a Google Drive link (only if audioUrl was provided)
      const driveMatch = audioUrl.match(/drive\.google\.com\/file\/d\/([^/]+)/);
      const driveOpenMatch = audioUrl.match(/drive\.google\.com\/open\?id=([^&]+)/);
      const fileId = driveMatch?.[1] || driveOpenMatch?.[1];

      if (fileId && staffId) {
        console.log('Google Drive file detected, ID:', fileId);
        
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
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
                // Parse file size from the URL if available
                const parts = driveUrl.split(':');
                const extractedFileId = parts[1];
                const fileSize = parts[2] ? parseInt(parts[2], 10) : undefined;
                
                // Need to download and re-upload to AssemblyAI
                finalAudioUrl = await uploadToAssemblyAI(extractedFileId, accessToken, ASSEMBLYAI_API_KEY, fileSize);
              } else {
                finalAudioUrl = driveUrl;
              }
            } catch (driveError) {
              console.error('Google Drive access error:', driveError);
              // Re-throw with original message if it's already a user-friendly message
              if (driveError instanceof Error && (
                driveError.message.includes('Acesso negado') ||
                driveError.message.includes('não encontrado') ||
                driveError.message.includes('Sessão do Google') ||
                driveError.message.includes('muito grande') ||
                driveError.message.includes('cannotDownloadFile') ||
                driveError.message.includes('bloqueou o download')
              )) {
                throw driveError;
              }
              throw new Error('Não foi possível acessar o arquivo no Google Drive. Verifique as permissões do arquivo.');
            }
          } else {
            throw new Error('Sessão do Google expirada. Reconecte o Google Calendar nas configurações.');
          }
        } else {
          throw new Error('Google não conectado. Conecte o Google Calendar nas configurações para acessar arquivos do Drive.');
        }
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
        language_code: language_code || 'pt',
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
