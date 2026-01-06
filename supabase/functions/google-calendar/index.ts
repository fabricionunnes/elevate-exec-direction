import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
    }>;
  };
  htmlLink: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error("User auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    console.log(`Google Calendar action: ${action} for user: ${user.id}`);

    // Check for target_user_id query param (for CS/Admin viewing other calendars)
    const targetUserId = url.searchParams.get("target_user_id");
    const effectiveUserId = targetUserId || user.id;

    // Check if user has Google tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from("user_google_tokens")
      .select("*")
      .eq("user_id", effectiveUserId)
      .single();

    if (action === "check-connection") {
      return new Response(
        JSON.stringify({ connected: !!tokenData && !tokenError }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list-connected-staff") {
      // List all staff members who have connected their Google Calendar
      const { data: connectedTokens } = await supabase
        .from("user_google_tokens")
        .select("user_id");

      if (!connectedTokens || connectedTokens.length === 0) {
        return new Response(
          JSON.stringify({ staff: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userIds = connectedTokens.map((t) => t.user_id);

      // Get staff info for these users
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id, name, role, user_id")
        .in("user_id", userIds)
        .eq("is_active", true);

      return new Response(
        JSON.stringify({ staff: staffData || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "disconnect") {
      if (tokenData) {
        await supabase
          .from("user_google_tokens")
          .delete()
          .eq("user_id", user.id);
      }
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "save-token") {
      const body = await req.json();
      const { access_token, refresh_token, expires_in } = body;

      const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

      const { error: upsertError } = await supabase
        .from("user_google_tokens")
        .upsert({
          user_id: user.id,
          access_token,
          refresh_token,
          token_expires_at: expiresAt.toISOString(),
        }, {
          onConflict: "user_id"
        });

      if (upsertError) {
        console.error("Token save error:", upsertError);
        return new Response(
          JSON.stringify({ error: "Failed to save token" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "events") {
      if (!tokenData) {
        return new Response(
          JSON.stringify({ error: "Not connected to Google Calendar", needsAuth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let accessToken = tokenData.access_token;

      // Check if token is expired and refresh if needed
      if (tokenData.token_expires_at && new Date(tokenData.token_expires_at) < new Date()) {
        console.log("Token expired, attempting refresh...");
        
        if (!tokenData.refresh_token) {
          return new Response(
            JSON.stringify({ error: "Token expired, please reconnect", needsAuth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ error: "Token expired, please reconnect", needsAuth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch calendar events
      const now = new Date();
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Next 30 days

      const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=100`;

      console.log("Fetching calendar events...");
      
      const calendarResponse = await fetch(calendarUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!calendarResponse.ok) {
        const errorText = await calendarResponse.text();
        console.error("Calendar API error:", errorText);
        
        if (calendarResponse.status === 401) {
          return new Response(
            JSON.stringify({ error: "Token invalid, please reconnect", needsAuth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Failed to fetch calendar events" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const calendarData = await calendarResponse.json();
      const events: CalendarEvent[] = calendarData.items || [];

      // Process events to extract meeting links
      const processedEvents = events.map((event) => {
        let meetingLink = event.hangoutLink || null;
        
        // Check for other conference links
        if (!meetingLink && event.conferenceData?.entryPoints) {
          const videoEntry = event.conferenceData.entryPoints.find(
            (ep) => ep.entryPointType === "video"
          );
          if (videoEntry) {
            meetingLink = videoEntry.uri;
          }
        }

        return {
          id: event.id,
          title: event.summary || "(Sem título)",
          description: event.description,
          start: event.start.dateTime || event.start.date,
          end: event.end.dateTime || event.end.date,
          meetingLink,
          calendarLink: event.htmlLink,
        };
      });

      console.log(`Found ${processedEvents.length} events`);

      return new Response(
        JSON.stringify({ events: processedEvents }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create-event") {
      if (!tokenData) {
        return new Response(
          JSON.stringify({ error: "Not connected to Google Calendar", needsAuth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();
      const { title, description, startDateTime, endDateTime, attendees } = body;

      if (!title || !startDateTime || !endDateTime) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: title, startDateTime, endDateTime" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accessToken = tokenData.access_token;

      // Check if token is expired
      if (tokenData.token_expires_at && new Date(tokenData.token_expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Token expired, please reconnect", needsAuth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create event with Google Meet link
      const eventData: Record<string, unknown> = {
        summary: title,
        description: description || "",
        start: {
          dateTime: startDateTime,
          timeZone: "America/Sao_Paulo",
        },
        end: {
          dateTime: endDateTime,
          timeZone: "America/Sao_Paulo",
        },
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: {
              type: "hangoutsMeet",
            },
          },
        },
      };

      // Add attendees if provided
      if (attendees && Array.isArray(attendees) && attendees.length > 0) {
        eventData.attendees = attendees.map((email: string) => ({ email }));
      }

      console.log("Creating calendar event with Meet link...", eventData);

      const createUrl = "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all";
      
      const createResponse = await fetch(createUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventData),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error("Create event error:", errorText);
        
        if (createResponse.status === 401) {
          return new Response(
            JSON.stringify({ error: "Token invalid, please reconnect", needsAuth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (createResponse.status === 403) {
          return new Response(
            JSON.stringify({ error: "Permissão negada. Reconecte sua conta Google com permissões de escrita.", needsAuth: true }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Failed to create event: " + errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const createdEvent = await createResponse.json();
      console.log("Event created successfully:", createdEvent.id);

      const meetingLink = createdEvent.hangoutLink || 
        createdEvent.conferenceData?.entryPoints?.find((ep: { entryPointType: string; uri: string }) => ep.entryPointType === "video")?.uri;

      return new Response(
        JSON.stringify({
          success: true,
          event: {
            id: createdEvent.id,
            title: createdEvent.summary,
            start: createdEvent.start.dateTime || createdEvent.start.date,
            end: createdEvent.end.dateTime || createdEvent.end.date,
            meetingLink,
            calendarLink: createdEvent.htmlLink,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update-event") {
      if (!tokenData) {
        return new Response(
          JSON.stringify({ error: "Not connected to Google Calendar", needsAuth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();
      const { eventId, title, description, startDateTime, endDateTime, attendees } = body;

      if (!eventId || !title || !startDateTime || !endDateTime) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: eventId, title, startDateTime, endDateTime" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accessToken = tokenData.access_token;

      // Check if token is expired
      if (tokenData.token_expires_at && new Date(tokenData.token_expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Token expired, please reconnect", needsAuth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update event
      const eventData: Record<string, unknown> = {
        summary: title,
        description: description || "",
        start: {
          dateTime: startDateTime,
          timeZone: "America/Sao_Paulo",
        },
        end: {
          dateTime: endDateTime,
          timeZone: "America/Sao_Paulo",
        },
      };

      // Add attendees if provided
      if (attendees && Array.isArray(attendees) && attendees.length > 0) {
        eventData.attendees = attendees.map((email: string) => ({ email }));
      }

      console.log("Updating calendar event...", eventData);

      const updateUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`;
      
      const updateResponse = await fetch(updateUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventData),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error("Update event error:", errorText);
        
        if (updateResponse.status === 401) {
          return new Response(
            JSON.stringify({ error: "Token invalid, please reconnect", needsAuth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (updateResponse.status === 403) {
          return new Response(
            JSON.stringify({ error: "Permissão negada. Reconecte sua conta Google com permissões de escrita.", needsAuth: true }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Failed to update event: " + errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updatedEvent = await updateResponse.json();
      console.log("Event updated successfully:", updatedEvent.id);

      const meetingLink = updatedEvent.hangoutLink || 
        updatedEvent.conferenceData?.entryPoints?.find((ep: { entryPointType: string; uri: string }) => ep.entryPointType === "video")?.uri;

      return new Response(
        JSON.stringify({
          success: true,
          event: {
            id: updatedEvent.id,
            title: updatedEvent.summary,
            start: updatedEvent.start.dateTime || updatedEvent.start.date,
            end: updatedEvent.end.dateTime || updatedEvent.end.date,
            meetingLink,
            calendarLink: updatedEvent.htmlLink,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete-event") {
      if (!tokenData) {
        return new Response(
          JSON.stringify({ error: "Not connected to Google Calendar", needsAuth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();
      const { eventId } = body;

      if (!eventId) {
        return new Response(
          JSON.stringify({ error: "Missing required field: eventId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accessToken = tokenData.access_token;

      // Check if token is expired
      if (tokenData.token_expires_at && new Date(tokenData.token_expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Token expired, please reconnect", needsAuth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Deleting calendar event...", eventId);

      const deleteUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`;
      
      const deleteResponse = await fetch(deleteUrl, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!deleteResponse.ok && deleteResponse.status !== 204) {
        const errorText = await deleteResponse.text();
        console.error("Delete event error:", errorText);
        
        if (deleteResponse.status === 401) {
          return new Response(
            JSON.stringify({ error: "Token invalid, please reconnect", needsAuth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Failed to delete event: " + errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Event deleted successfully");

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Google Calendar function error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
