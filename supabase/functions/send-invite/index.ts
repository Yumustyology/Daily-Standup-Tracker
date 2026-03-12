import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function checkExisting(supabaseAdmin: SupabaseClient, orgId: string, email: string) {
  const { data, error } = await supabaseAdmin
    .from('org_members')
    .select('status')
    .eq('org_id', orgId)
    .eq('invited_email', email)
    .in('status', ['active', 'pending'])
    .single();

  // PGRST116 = no rows found, which is fine
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Supabase error: ${error.message}`);
  }
  return data;
}

// Send email via Brevo REST API (no package needed — pure fetch)
async function sendBrevoEmail({
  to,
  subject,
  html,
  inviterEmail,
}: {
  to: string;
  subject: string;
  html: string;
  inviterEmail: string;
}) {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  if (!apiKey) throw new Error('BREVO_API_KEY is not set');

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: 'StandupLog',
        email: Deno.env.get('BREVO_SENDER_EMAIL') || inviterEmail,
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Brevo API error ${response.status}: ${errorBody}`);
  }

  return await response.json();
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const orgId = body.orgId;
    const orgName = body.orgName;
    const email = body.email || body.inviteeEmail;
    const inviterEmail = body.inviterEmail;

    if (!orgId || !orgName || !email || !inviterEmail) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Missing required fields. Received: ${JSON.stringify({ orgId, orgName, email, inviterEmail })}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ✅ Auth check — must come after supabaseAdmin is created and orgId is parsed
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) {
      return new Response(JSON.stringify({ error: 'Invalid authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const { data: member, error: memberError } = await supabaseAdmin
      .from('org_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single();
    if (memberError || !member || member.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can send invites.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // Check if already a member or already invited
    const existing = await checkExisting(supabaseAdmin, orgId, email);
    if (existing) {
      const errorMsg = existing.status === 'active'
        ? 'User is already a member of this organization.'
        : 'An invitation has already been sent to this email address.';
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
      );
    }

    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:5173';

   const html = `
      <div style="font-family: Arial, sans-serif; background-color: #0f0f0f; color: #a3a3a3; padding: 40px; text-align: center;">
        <div style="max-width: 600px; margin: auto; background-color: #1a1a1a; border-radius: 8px; overflow: hidden; border: 1px solid #1f1f1f;">
          <div style="padding: 40px;">
            <h1 style="color: #f59e0b; font-size: 24px; font-weight: bold; margin: 0 0 20px;">StandupLog</h1>
            <h2 style="color: #ffffff; font-size: 28px; margin: 0 0 20px;">You're invited!</h2>
            <p style="font-size: 16px; line-height: 1.5; margin: 0 0 30px;">
              <strong style="color: #ffffff;">${inviterEmail}</strong> has invited you to join
              <strong style="color: #ffffff;">${orgName}</strong> on StandupLog —
              the daily standup tracker for remote teams.
            </p>
            <a
              href="${appUrl}"
              style="background-color: #f59e0b; color: #1a1a1a; text-decoration: none; padding: 15px 30px; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;"
            >
              Accept Invite &amp; Join ${orgName}
            </a>
          </div>
          <div style="background-color: #111111; padding: 20px; text-align: center;">
            <p style="font-size: 12px; color: #525252; margin: 0;">
              If you weren't expecting this invite, you can ignore this email.
            </p>
          </div>
        </div>
      </div>
    `;

    await sendBrevoEmail({
      to: email,
      subject: `You have been invited to join ${orgName} on StandupLog`,
      html,
      inviterEmail,
    });

    const { error: insertError } = await supabaseAdmin
      .from('org_members')
      .insert({ org_id: orgId, invited_email: email, status: 'pending', user_id: null });

    if (insertError) {
      throw new Error(`Failed to record invitation: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});