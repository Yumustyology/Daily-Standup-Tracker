import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'npm:resend';

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

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Supabase error: ${error.message}`);
  }
  return data;
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orgId, orgName, email, inviterEmail } = await req.json();

    // Validate input — removed inviterId, not needed
    if (!orgId || !orgName || !email || !inviterEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

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

    // FIX: correct Resend setup matching your working config
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:5173';

    const { error: emailError } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: `You have been invited to join ${orgName} on StandupLog`,
      html: `
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
                Accept Invite & Join ${orgName}
              </a>
            </div>
            <div style="background-color: #111111; padding: 20px; text-align: center;">
              <p style="font-size: 12px; color: #525252; margin: 0;">
                If you weren't expecting this invite, you can ignore this email.
              </p>
            </div>
          </div>
        </div>
      `,
    });

    if (emailError) {
      console.error('Resend error:', emailError);
      throw new Error('Failed to send invitation email.');
    }

    // FIX: user_id must be NULL for pending invites — not the inviter's ID
    const { error: insertError } = await supabaseAdmin
      .from('org_members')
      .insert({
        org_id: orgId,
        invited_email: email,
        status: 'pending',
        user_id: null, // will be set to the real user's ID when they accept
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error('Failed to record invitation in the database.');
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});