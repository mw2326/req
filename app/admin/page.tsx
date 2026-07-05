'use client';

import { useEffect, useState } from 'react';

type AdminPosting = {
  id: string;
  company: string;
  role: string;
  skills: string[];
  status: 'visible' | 'removed';
  created_at: string;
  reportCount: number;
  reportReasons: string[];
};

type NameCount = { canonicalName: string; count: number };

const TABS = [
  { id: 'reports', label: 'Reports' },
  { id: 'companies', label: 'Companies' },
  { id: 'skills', label: 'Skills' },
] as const;

function MergeRow({
  item,
  onMerge,
}: {
  item: NameCount;
  onMerge: (from: string, to: string) => Promise<void>;
}) {
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!target.trim()) return;
    setBusy(true);
    try {
      await onMerge(item.canonicalName, target.trim());
      setTarget('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-hairline rounded-lg px-6 py-3.5 mb-2 bg-surface flex items-center justify-between gap-3 flex-wrap">
      <div>
        <span className="font-display font-semibold text-[14px]">{item.canonicalName}</span>
        <span className="font-mono text-[10.5px] text-ink2 ml-2.5">
          {item.count} posting{item.count === 1 ? '' : 's'}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="merge into..."
          className="bg-surface2 border border-hairline rounded font-mono text-[12px] px-3 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-amber"
        />
        <button
          onClick={submit}
          disabled={busy || !target.trim()}
          className="font-mono text-[11px] uppercase border border-hairline px-5 py-1.5 rounded hover:border-ink2 disabled:opacity-40"
        >
          Merge
        </button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('reports');
  const [authorized, setAuthorized] = useState(true);
  const [loading, setLoading] = useState(true);

  const [postings, setPostings] = useState<AdminPosting[] | null>(null);
  const [companies, setCompanies] = useState<NameCount[] | null>(null);
  const [skills, setSkills] = useState<NameCount[] | null>(null);

  async function loadTab(t: (typeof TABS)[number]['id']) {
    setLoading(true);
    try {
      const endpoint =
        t === 'reports' ? '/api/admin/postings' : t === 'companies' ? '/api/admin/companies' : '/api/admin/skills';
      const res = await fetch(endpoint);
      if (res.status === 403 || res.status === 401) {
        setAuthorized(false);
        return;
      }
      const data = await res.json();
      if (t === 'reports') setPostings(Array.isArray(data) ? data : []);
      else if (t === 'companies') setCompanies(Array.isArray(data) ? data : []);
      else setSkills(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function setStatus(id: string, status: 'visible' | 'removed') {
    await fetch(`/api/admin/postings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadTab('reports');
  }

  async function mergeCompany(from: string, to: string) {
    await fetch('/api/admin/companies/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to }),
    });
    loadTab('companies');
  }

  async function mergeSkill(from: string, to: string) {
    await fetch('/api/admin/skills/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to }),
    });
    loadTab('skills');
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-ink text-white flex items-center justify-center">
        <div className="font-mono text-sm text-ink2">Not authorized.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink text-white">
      <div className="max-w-[1470px] mx-auto px-5 pt-7 pb-20">
        <h1 className="font-display font-semibold text-[19px] mb-1">Admin</h1>
        <p className="text-ink2 text-[13.5px] leading-relaxed mb-5">
          Moderate reported postings, and fix company/skill normalization mistakes.
        </p>

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

        {loading && <div className="font-mono text-xs text-ink2">loading…</div>}

        {tab === 'reports' && !loading && (
          <>
            {(postings ?? []).map((p) => (
              <div key={p.id} className="border border-hairline rounded-lg px-6 py-4 mb-2.5 bg-surface">
                <div className="flex justify-between items-start gap-2.5 flex-wrap">
                  <div>
                    <span className="font-display font-semibold text-[15px]">{p.company}</span>
                    <span className="text-ink2 text-[12.5px]"> &nbsp; {p.role}</span>
                    <div className="font-mono text-[10.5px] text-[#565d6b] mt-0.5">
                      {p.status} · {p.reportCount} report{p.reportCount === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {p.status === 'visible' ? (
                      <button
                        onClick={() => setStatus(p.id, 'removed')}
                        className="font-mono text-[11px] uppercase border border-coral text-coral px-5 py-1.5 rounded"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        onClick={() => setStatus(p.id, 'visible')}
                        className="font-mono text-[11px] uppercase border border-teal text-teal px-5 py-1.5 rounded"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </div>
                {p.reportReasons.length > 0 && (
                  <div className="mt-2.5 font-mono text-[11px] text-ink2 leading-relaxed">
                    {p.reportReasons.map((r, i) => (
                      <div key={i}>"{r}"</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {postings && postings.length === 0 && <div className="font-mono text-xs text-ink2">No postings yet.</div>}
          </>
        )}

        {tab === 'companies' && !loading && (
          <>
            <p className="font-mono text-[11px] text-ink2 mb-4">
              Type a target name and hit Merge to fold one company into another (or rename it).
            </p>
            {(companies ?? []).map((c) => (
              <MergeRow key={c.canonicalName} item={c} onMerge={mergeCompany} />
            ))}
            {companies && companies.length === 0 && <div className="font-mono text-xs text-ink2">No companies yet.</div>}
          </>
        )}

        {tab === 'skills' && !loading && (
          <>
            <p className="font-mono text-[11px] text-ink2 mb-4">
              Type a target name and hit Merge to fold one skill into another (or rename it).
            </p>
            {(skills ?? []).map((s) => (
              <MergeRow key={s.canonicalName} item={s} onMerge={mergeSkill} />
            ))}
            {skills && skills.length === 0 && <div className="font-mono text-xs text-ink2">No skills yet.</div>}
          </>
        )}
      </div>
    </div>
  );
}
