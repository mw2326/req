import { NextRequest, NextResponse } from 'next/server';
import { callGroq } from '@/lib/groq';
import { getUser } from '@/lib/supabase-server';
import { checkRateLimit, getGroqLimiter } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

    const { success } = await checkRateLimit(getGroqLimiter(), user.id);
    if (!success) {
      return NextResponse.json({ error: 'Rate limit exceeded — try again later.' }, { status: 429 });
    }

    const { gapSkills, dreamCompany } = await req.json();
    if (!Array.isArray(gapSkills) || !gapSkills.length || !dreamCompany) {
      return NextResponse.json({ error: 'Missing gapSkills or dreamCompany.' }, { status: 400 });
    }

    const prompt = `A college student is trying to break into a role at ${dreamCompany}. Based on postings, they are missing these skills: ${gapSkills.join(', ')}.

Suggest 2-3 concrete, buildable weekend/semester-scale portfolio projects. Favor projects that each cover MULTIPLE missing skills at once over one-skill-one-project. Pick project subject matter a student would actually enjoy (games, music, sports, personal finance, etc) rather than generic CRUD apps where possible.

Return ONLY valid JSON, no markdown fences, no preamble, matching exactly this shape:
[{"title": string, "description": string (1-2 sentences, plain and specific), "skillsCovered": string[]}]`;

    const raw = await callGroq(prompt);
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error('projects error:', err);
    return NextResponse.json({ error: err.message ?? 'Project generation failed.' }, { status: 500 });
  }
}
