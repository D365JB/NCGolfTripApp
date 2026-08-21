// Supabase Edge Function: course-proxy
// Keeps the GolfCourseAPI key server-side. Deploy once a Supabase project exists:
//   supabase secrets set GOLF_COURSE_API_KEY=your_key
//   supabase functions deploy course-proxy
//
// GET  /course-proxy?search=Pinehurst      -> search courses
// GET  /course-proxy?id=1234               -> fetch one course (holes, tees, ratings)

const API_BASE = 'https://api.golfcourseapi.com/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('GOLF_COURSE_API_KEY');
  if (!apiKey) {
    return json({ error: 'GOLF_COURSE_API_KEY not configured' }, 500);
  }

  const url = new URL(req.url);
  const search = url.searchParams.get('search');
  const id = url.searchParams.get('id');

  let target: string;
  if (id) {
    target = `${API_BASE}/courses/${encodeURIComponent(id)}`;
  } else if (search) {
    target = `${API_BASE}/search?search_query=${encodeURIComponent(search)}`;
  } else {
    return json({ error: 'Provide a "search" or "id" query parameter' }, 400);
  }

  try {
    const upstream = await fetch(target, {
      headers: { Authorization: `Key ${apiKey}` },
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return json({ error: 'Upstream request failed', detail: String(err) }, 502);
  }
});

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
