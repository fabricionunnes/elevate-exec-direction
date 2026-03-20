import { supabase } from "@/integrations/supabase/client";

export async function startGoogleCalendarConnection(returnPath: string) {
  const normalizedReturnPath = returnPath.startsWith("/") ? returnPath : `/${returnPath}`;

  const { data, error } = await supabase.functions.invoke("google-calendar?action=auth-url", {
    body: {
      redirectUri: window.location.origin,
      returnPath: normalizedReturnPath,
    },
  });

  if (error) throw error;
  if (!data?.authUrl) throw new Error("Auth URL não retornada");

  window.location.href = data.authUrl;
}