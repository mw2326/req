import { NextRequest, NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';
import { callGroq } from '@/lib/groq';
import { getUser } from '@/lib/supabase-server';
import { checkRateLimit, getGroqLimiter } from '@/lib/rate-limit';

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

    const { success } = await checkRateLimit(getGroqLimiter(), user.id);
    if (!success) {
      return NextResponse.json({ error: 'Rate limit exceeded — try again later.' }, { status: 429 });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file.' }, { status: 400 });
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File is too large (max 5MB).' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    const { text } = await parser.getText();

    if (!text.trim()) {
      return NextResponse.json({ error: 'Could not extract text from this PDF.' }, { status: 400 });
    }

    const prompt = `Extract a deduplicated list of concrete technical skills from this resume — technical skills, tools, languages, frameworks, and specific hard requirements (e.g. "SQL", "Python", "AWS", "Figma"). Do not include vague soft skills like "team player" or generic phrases. Keep each skill short (1-4 words), deduplicated, and in a consistent canonical form (e.g. "JavaScript" not "JS/Javascript"). Aim for 6-20 skills.

Return ONLY valid JSON, no markdown fences, no preamble, matching exactly this shape:
string[]

RESUME:
"""
${text.slice(0, 8000)}
"""`;

    const raw = await callGroq(prompt);
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error('resume error:', err);
    return NextResponse.json({ error: err.message ?? 'Resume parsing failed.' }, { status: 500 });
  }
}
