'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase-browser';

type Posting = {
  id: string;
  company: string;
  role: string;
  skills: string[];
  raw_text: string;
  created_at: string;
};

type Extracted = { company: string; role: string; skills: string[] };
type Project = { title: string; description: string; skillsCovered: string[] };
type Profile = { mySkills: string[]; dreamCompany: string };

const TABS = [
  { id: 'add', label: 'Add Posting' },
  { id: 'search', label: 'Search' },
  { id: 'dream', label: 'Dream Company' },
] as const;

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlight(text: string, skills: string[]) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let out = esc(text);
  const sorted = [...skills].sort((a, b) => b.length - a.length).filter((s) => s.trim().length > 1);
  if (!sorted.length) return out;
  const pattern = sorted.map(escapeRegex).join('|');
  const re = new RegExp(`(?<![A-Za-z0-9])(${pattern})(?![A-Za-z0-9])`, 'gi');
  return out.replace(re, '<mark class="kw">$1</mark>');
}

function normSkill(s: string) {
  return s.trim().toLowerCase();
}

async function loadProfile(): Promise<Profile> {
  try {
    const res = await fetch('/api/profile');
    if (!res.ok) return { mySkills: [], dreamCompany: '' };
    const data = await res.json();
    return { mySkills: data.mySkills ?? [], dreamCompany: data.dreamCompany ?? '' };
  } catch {
    return { mySkills: [], dreamCompany: '' };
  }
}

async function saveProfile(p: Profile) {
  try {
    await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
  } catch {
    // best-effort; local state already updated optimistically
  }
}

function Chip({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'match' | 'gap' }) {
  const toneClass =
    tone === 'match'
      ? 'border-teal text-teal'
      : tone === 'gap'
      ? 'border-coral text-coral'
      : 'border-hairline text-white';
  return (
    <span className={`font-mono text-[11.5px] px-2.5 py-1 rounded-full border bg-surface2 whitespace-nowrap ${toneClass}`}>
      {children}
    </span>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-dashed border-hairline rounded-lg px-6 py-8 text-center text-ink2 text-sm leading-relaxed">
      <div className="font-display text-white text-[15px] mb-1.5">{title}</div>
      {body}
    </div>
  );
}

export default function Page() {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('add');
  const [dbCount, setDbCount] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Add tab
  const [jdText, setJdText] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<Extracted | null>(null);

  // Search tab
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Posting[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Dream company tab
  const [profile, setProfile] = useState<Profile>({ mySkills: [], dreamCompany: '' });
  const [dreamInput, setDreamInput] = useState('');
  const [dreamPostings, setDreamPostings] = useState<Posting[] | null>(null);
  const [skillInput, setSkillInput] = useState('');
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [genLoading, setGenLoading] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch('/api/postings');
      const data = await res.json();
      setDbCount(Array.isArray(data) ? data.length : 0);
    } catch {
      setDbCount(0);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const p = await loadProfile();
      setProfile(p);
      setDreamInput(p.dreamCompany || '');
      if (p.dreamCompany) loadDreamPostings(p.dreamCompany);
    })();
    refreshCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshCount]);

  async function signOut() {
    const supabase = getBrowserSupabase();
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function handleScan() {
    if (!jdText.trim()) {
      showToast('Paste a job description first');
      return;
    }
    setScanning(true);
    setResult(null);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: jdText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch {
      showToast('Scan failed — try again');
    } finally {
      setScanning(false);
    }
  }

  async function confirmAdd() {
    if (!result) return;
    try {
      const res = await fetch('/api/postings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...result, rawText: jdText }),
      });
      if (!res.ok) throw new Error();
      showToast(`Added ${result.company} — ${result.role} to the database`);
      setJdText('');
      setResult(null);
      refreshCount();
    } catch {
      showToast('Could not save posting — try again');
    }
  }

  async function runSearch() {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/postings?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function reportPosting(id: string) {
    try {
      const res = await fetch(`/api/postings/${id}/report`, { method: 'POST' });
      if (!res.ok) throw new Error();
      showToast('Reported — thanks, a moderator will review it');
    } catch {
      showToast('Could not report posting — try again');
    }
  }

  async function loadDreamPostings(company: string) {
    try {
      const res = await fetch(`/api/postings?company=${encodeURIComponent(company)}`);
      const data = await res.json();
      setDreamPostings(Array.isArray(data) ? data : []);
    } catch {
      setDreamPostings([]);
    }
  }

  async function setDreamCompany() {
    if (!dreamInput.trim()) {
      showToast('Enter a company name first');
      return;
    }
    const next = { ...profile, dreamCompany: dreamInput.trim() };
    setProfile(next);
    saveProfile(next);
    setProjects(null);
    await loadDreamPostings(dreamInput.trim());
  }

  function addSkill() {
    const v = skillInput.trim();
    if (!v) return;
    if (!profile.mySkills.some((s) => normSkill(s) === normSkill(v))) {
      const next = { ...profile, mySkills: [...profile.mySkills, v] };
      setProfile(next);
      saveProfile(next);
    }
    setSkillInput('');
  }

  function removeSkill(skill: string) {
    const next = { ...profile, mySkills: profile.mySkills.filter((s) => s !== skill) };
    setProfile(next);
    saveProfile(next);
  }

  async function generateProjects(gapLabels: string[]) {
    setGenLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gapSkills: gapLabels.slice(0, 8), dreamCompany: profile.dreamCompany }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProjects(data);
    } catch {
      showToast('Could not generate project ideas');
    } finally {
      setGenLoading(false);
    }
  }

  // ---- derived: search stats ----
  const searchFreq: [string, number][] = [];
  if (searchResults && searchResults.length) {
    const freq: Record<string, number> = {};
    searchResults.forEach((p) => p.skills.forEach((s) => (freq[s] = (freq[s] || 0) + 1)));
    searchFreq.push(...Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8));
  }
  const searchCompanies = searchResults ? new Set(searchResults.map((p) => p.company)).size : 0;
  const maxFreq = searchFreq.length ? searchFreq[0][1] : 1;

  // ---- derived: dream gap ----
  const mySkillsNorm = new Set(profile.mySkills.map(normSkill));
  const dreamFreq: Record<string, { label: string; count: number }> = {};
  (dreamPostings || []).forEach((p) =>
    p.skills.forEach((s) => {
      const key = normSkill(s);
      dreamFreq[key] = { label: s, count: (dreamFreq[key]?.count || 0) + 1 };
    })
  );
  const ranked = Object.values(dreamFreq).sort((a, b) => b.count - a.count);
  const matched = ranked.filter((r) => mySkillsNorm.has(normSkill(r.label)));
  const gaps = ranked.filter((r) => !mySkillsNorm.has(normSkill(r.label)));
  const coverage = ranked.length ? Math.round((matched.length / ranked.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-ink text-white">
      <div className="max-w-[980px] mx-auto px-5 pt-7 pb-20">
        {/* header */}
        <div className="flex items-baseline justify-between flex-wrap gap-2.5 mb-6">
          <div className="flex items-baseline gap-2.5">
            <div className="font-display font-bold text-[22px] tracking-tight">
              RE<span className="text-amber">Q</span>
            </div>
            <div className="font-mono text-xs text-ink2">// requirement intelligence, crowdsourced</div>
          </div>
          <div className="flex items-center gap-3.5">
            <div className="font-mono text-[11px] text-ink2">
              {dbCount === null ? '—' : dbCount} posting{dbCount === 1 ? '' : 's'} tracked
            </div>
            <button
              onClick={signOut}
              className="font-mono text-[11px] uppercase text-ink2 hover:text-white border border-hairline rounded px-3.5 py-1.5"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* tabs */}
        <div className="flex gap-0.5 border-b border-hairline mb-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`font-mono text-[12.5px] uppercase tracking-wide px-4 py-2.5 -mb-px border-b-2 transition-colors ${
                tab === t.id ? 'text-amber border-amber' : 'text-ink2 border-transparent hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ADD */}
        {tab === 'add' && (
          <div>
            <h2 className="font-display font-semibold text-[19px] mb-1">Paste a job posting</h2>
            <p className="text-ink2 text-[13.5px] leading-relaxed mb-5">
              Drop in any internship or new-grad posting. We&apos;ll pull the company, role, and every screenable
              requirement — then add it to the shared database so other students can search it.
            </p>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the full job description here — company name, role title, and requirements included..."
              className="w-full min-h-[200px] bg-surface border border-hairline rounded font-mono text-[13px] leading-relaxed p-3.5 text-white placeholder:text-[#565d6b] focus:outline-none focus:ring-2 focus:ring-amber"
            />
            <div className="flex items-center gap-2.5 mt-3.5 flex-wrap">
              <button
                onClick={handleScan}
                disabled={scanning}
                className="font-mono text-[12.5px] uppercase tracking-wide bg-amber text-[#14161b] font-semibold px-6 py-2.5 rounded disabled:opacity-40"
              >
                Scan posting
              </button>
              {scanning && (
                <span className="font-mono text-xs text-ink2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" /> extracting requirements…
                </span>
              )}
            </div>

            {result && (
              <div className="mt-6 border border-hairline rounded-lg bg-surface overflow-hidden">
                <div className="px-4.5 py-4 border-b border-hairline flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <div className="font-display font-semibold text-[17px]">{result.company}</div>
                    <div className="text-ink2 text-[13px] mt-0.5">{result.role}</div>
                  </div>
                  <button
                    onClick={confirmAdd}
                    className="font-mono text-[11px] uppercase bg-amber text-[#14161b] font-semibold px-4.5 py-1.5 rounded"
                  >
                    Add to database
                  </button>
                </div>
                <div
                  className="px-4.5 py-4 max-h-[220px] overflow-y-auto font-mono text-[12.5px] leading-[1.8] text-ink2 border-b border-hairline whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: highlight(jdText, result.skills) }}
                />
                <div className="px-4.5 py-4 flex flex-wrap gap-1.5">
                  {result.skills.map((s) => (
                    <Chip key={s}>{s}</Chip>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SEARCH */}
        {tab === 'search' && (
          <div>
            <h2 className="font-display font-semibold text-[19px] mb-1">Search the database</h2>
            <p className="text-ink2 text-[13.5px] leading-relaxed mb-5">
              Look up a company, a role, or a skill to see what&apos;s actually being asked for across every posting
              the community has added.
            </p>
            <div className="flex gap-2 mb-5">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                placeholder='Try a company, e.g. "Stripe", or a skill, e.g. "SQL"'
                className="flex-1 bg-surface border border-hairline rounded font-mono text-[13px] px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber"
              />
              <button
                onClick={runSearch}
                className="font-mono text-[12.5px] uppercase border border-hairline px-5 py-2.5 rounded hover:border-ink2"
              >
                Search
              </button>
            </div>

            {searching && <div className="font-mono text-xs text-ink2">searching…</div>}

            {!searching && searchResults && searchResults.length === 0 && (
              <Empty
                title="No matches yet"
                body={`Nobody has added a posting matching "${searchQuery.trim()}". Add one from the Add Posting tab to start building the picture.`}
              />
            )}

            {!searching && searchResults && searchResults.length > 0 && (
              <>
                <div className="flex gap-5 py-3.5 border-t border-b border-hairline mb-5 flex-wrap">
                  <div>
                    <div className="font-display font-bold text-[22px] text-amber">{searchResults.length}</div>
                    <div className="font-mono text-[10.5px] uppercase text-ink2 tracking-wide">postings</div>
                  </div>
                  <div>
                    <div className="font-display font-bold text-[22px] text-amber">{searchCompanies}</div>
                    <div className="font-mono text-[10.5px] uppercase text-ink2 tracking-wide">companies</div>
                  </div>
                  <div>
                    <div className="font-display font-bold text-[22px] text-amber">{searchFreq.length}</div>
                    <div className="font-mono text-[10.5px] uppercase text-ink2 tracking-wide">top skills shown</div>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 mb-6">
                  {searchFreq.map(([skill, count]) => (
                    <div key={skill} className="grid grid-cols-[130px_1fr_34px] items-center gap-2.5">
                      <div className="font-mono text-xs truncate">{skill}</div>
                      <div className="h-2 bg-surface2 rounded overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber to-[#ffdf8a] rounded"
                          style={{ width: `${Math.round((count / maxFreq) * 100)}%` }}
                        />
                      </div>
                      <div className="font-mono text-[11px] text-ink2 text-right">
                        {count}/{searchResults.length}
                      </div>
                    </div>
                  ))}
                </div>

                {searchResults.slice(0, 25).map((p) => (
                  <div key={p.id} className="border border-hairline rounded-lg px-4 py-3.5 mb-2.5 bg-surface">
                    <div className="flex justify-between items-baseline gap-2.5 flex-wrap">
                      <div>
                        <span className="font-display font-semibold text-[15px]">{p.company}</span>
                        <span className="text-ink2 text-[12.5px]"> &nbsp; {p.role}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="font-mono text-[10.5px] text-[#565d6b]">
                          REQ-{p.id.slice(0, 6).toUpperCase()}
                        </div>
                        <button
                          onClick={() => reportPosting(p.id)}
                          className="font-mono text-[10px] uppercase text-ink2 hover:text-coral"
                        >
                          Report
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {p.skills.map((s) => (
                        <Chip key={s}>{s}</Chip>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* DREAM */}
        {tab === 'dream' && (
          <div>
            <h2 className="font-display font-semibold text-[19px] mb-1">Your dream company</h2>
            <p className="text-ink2 text-[13.5px] leading-relaxed mb-5">
              Set a target. We&apos;ll aggregate every requirement seen across postings from that company, compare
              it to your skills, and suggest projects that close the gap.
            </p>
            <div className="flex gap-2 mb-5">
              <input
                value={dreamInput}
                onChange={(e) => setDreamInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setDreamCompany()}
                placeholder="e.g. Palantir, Deloitte, Riot Games..."
                className="flex-1 bg-surface border border-hairline rounded font-mono text-[13px] px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber"
              />
              <button
                onClick={setDreamCompany}
                className="font-mono text-[12.5px] uppercase bg-amber text-[#14161b] font-semibold px-6 py-2.5 rounded"
              >
                Set target
              </button>
            </div>

            {profile.dreamCompany && dreamPostings && dreamPostings.length === 0 && (
              <Empty
                title={`No postings for ${profile.dreamCompany} yet`}
                body="Paste one from the Add Posting tab and we'll start building the requirement picture for this company."
              />
            )}

            {profile.dreamCompany && dreamPostings && dreamPostings.length > 0 && (
              <>
                <div className="flex gap-5 py-3.5 border-t border-b border-hairline mb-5 flex-wrap">
                  <div>
                    <div className="font-display font-bold text-[22px] text-amber">{dreamPostings.length}</div>
                    <div className="font-mono text-[10.5px] uppercase text-ink2 tracking-wide">postings seen</div>
                  </div>
                  <div>
                    <div className="font-display font-bold text-[22px] text-amber">{ranked.length}</div>
                    <div className="font-mono text-[10.5px] uppercase text-ink2 tracking-wide">requirements</div>
                  </div>
                  <div>
                    <div className="font-display font-bold text-[22px] text-teal">{coverage}%</div>
                    <div className="font-mono text-[10.5px] uppercase text-ink2 tracking-wide">covered by you</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4.5 mb-6">
                  <div>
                    <h3 className="font-mono text-[11px] uppercase text-ink2 tracking-wide mb-2.5">
                      You have ({matched.length})
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {matched.length ? (
                        matched.map((r) => (
                          <Chip key={r.label} tone="match">
                            {r.label}
                          </Chip>
                        ))
                      ) : (
                        <span className="text-ink2 text-[12.5px]">Nothing yet — add skills below.</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-mono text-[11px] uppercase text-ink2 tracking-wide mb-2.5">
                      Gap ({gaps.length})
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {gaps.length ? (
                        gaps.map((r) => (
                          <Chip key={r.label} tone="gap">
                            {r.label} <span className="opacity-60">×{r.count}</span>
                          </Chip>
                        ))
                      ) : (
                        <span className="text-ink2 text-[12.5px]">No gaps — you&apos;re covered.</span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="mt-6 pt-5 border-t border-hairline">
              <h3 className="font-mono text-[11px] uppercase text-ink2 tracking-wide mb-2.5">Your skills</h3>
              <div className="flex gap-2 mb-3">
                <input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                  placeholder="Add a skill, e.g. Python"
                  className="flex-1 bg-surface border border-hairline rounded font-mono text-[13px] px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber"
                />
                <button
                  onClick={addSkill}
                  className="font-mono text-[11px] uppercase border border-hairline px-4.5 py-1.5 rounded hover:border-ink2"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {profile.mySkills.length ? (
                  profile.mySkills.map((s) => (
                    <button key={s} onClick={() => removeSkill(s)} className="group">
                      <Chip>
                        {s} <span className="opacity-60 group-hover:opacity-100">×</span>
                      </Chip>
                    </button>
                  ))
                ) : (
                  <span className="text-ink2 text-[12.5px]">No skills added yet.</span>
                )}
              </div>
            </div>

            {profile.dreamCompany && gaps.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => generateProjects(gaps.map((g) => g.label))}
                    disabled={genLoading}
                    className="font-mono text-[12.5px] uppercase bg-amber text-[#14161b] font-semibold px-6 py-2.5 rounded disabled:opacity-40"
                  >
                    Generate project ideas for the gap
                  </button>
                  {genLoading && (
                    <span className="font-mono text-xs text-ink2 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" /> thinking through
                      projects…
                    </span>
                  )}
                </div>

                {projects && (
                  <div className="mt-5">
                    {projects.map((p) => (
                      <div
                        key={p.title}
                        className="border border-hairline border-l-[3px] border-l-amber rounded px-4 py-3.5 mb-2.5 bg-surface"
                      >
                        <div className="font-display font-semibold text-[14.5px] mb-1">{p.title}</div>
                        <div className="text-[13px] text-ink2 leading-relaxed mb-2">{p.description}</div>
                        <div className="font-mono text-[10.5px] text-teal">
                          covers: {p.skillsCovered.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-surface2 border border-hairline text-white font-mono text-[12.5px] px-4.5 py-2.5 rounded-lg shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
