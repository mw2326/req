import { NextRequest, NextResponse } from 'next/server';
import { callGroq } from '@/lib/groq';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Missing job posting text.' }, { status: 400 });
    }

    const prompt = `Extract structured info from this job posting. Return ONLY valid JSON, no markdown fences, no preamble, matching exactly this shape:
{"company": string, "role": string, "skills": string[]}

Rules for skills: include only concrete, screenable requirements — technical skills, tools, languages, frameworks, certifications, and specific hard requirements (e.g. "SQL", "Python", "AWS", "Figma", "GPA 3.0+"). Do not include vague soft skills like "team player" unless explicitly listed as a hard requirement. Keep each skill short (1-4 words), deduplicated, and in a consistent canonical form (e.g. "JavaScript" not "JS/Javascript"). Aim for 6-16 skills.
If you cannot find a clear company name, use "Unknown Company". If you cannot find a clear role title, use "Unknown Role".

JOB POSTING:
"""
${text.slice(0, 8000)}
"""`;

    const raw = await callGroq(prompt);
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Extraction failed.' }, { status: 500 });
  }
}
