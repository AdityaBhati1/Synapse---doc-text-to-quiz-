// quiz-proxy-worker.js
// Deploy this to Cloudflare Workers (free tier). It holds your Anthropic
// API key as a secret and is the only thing that ever talks to the
// Anthropic API — visitors to your public page never see the key.
//
// SETUP (one-time):
//   1. Sign up free at https://dash.cloudflare.com (no credit card needed
//      for the free tier).
//   2. Install Wrangler (Cloudflare's CLI):  npm install -g wrangler
//   3. In a new folder:  wrangler init quiz-proxy   (choose "Hello World" worker)
//   4. Replace the generated src/index.js with THIS file's contents.
//   5. Set your key as a secret (never put it in the code):
//        wrangler secret put ANTHROPIC_API_KEY
//      (paste your key when prompted)
//   6. Deploy:  wrangler deploy
//   7. Wrangler prints a URL like:
//        https://quiz-proxy.YOUR-SUBDOMAIN.workers.dev
//      Paste that URL into the app's "Backend URL" field.
//
// COST / ABUSE NOTE: this endpoint is open to anyone who has your page's
// link, so anyone who opens the page can trigger an API call billed to
// your key. For a small group this is usually fine and cheap. For
// wider release, add a shared secret (e.g. require a header the page
// sends) or a per-IP rate limit before going public at scale.

const ALLOWED_ORIGIN = '*'; // tighten to your page's exact origin once you know it

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    const { systemPrompt, userPrompt } = body;
    if (!systemPrompt || !userPrompt) {
      return new Response(JSON.stringify({ error: 'Missing systemPrompt or userPrompt' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    try {
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5',
          max_tokens: 4000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      const data = await anthropicRes.json();
      if (!anthropicRes.ok) {
        const msg = (data && data.error && data.error.message) || ('Anthropic API error ' + anthropicRes.status);
        return new Response(JSON.stringify({ error: msg }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders() },
        });
      }

      const text = (data.content || []).map((b) => b.text || '').join('');
      return new Response(JSON.stringify({ text }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Proxy error: ' + err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }
  },
};
