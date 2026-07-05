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

export default function AdminPage() {
  const [postings, setPostings] = useState<AdminPosting[] | null>(null);
  const [authorized, setAuthorized] = useState(true);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/postings');
      if (res.status === 403 || res.status === 401) {
        setAuthorized(false);
        return;
      }
      const data = await res.json();
      setPostings(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: 'visible' | 'removed') {
    await fetch(`/api/admin/postings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
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
        <h1 className="font-display font-semibold text-[19px] mb-1">Moderation</h1>
        <p className="text-ink2 text-[13.5px] leading-relaxed mb-6">
          Postings sorted by report count. Removing hides a posting from Search / Dream Company; it&apos;s reversible.
        </p>

        {loading && <div className="font-mono text-xs text-ink2">loading…</div>}

        {!loading &&
          (postings ?? []).map((p) => (
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
                    <div key={i}>&quot;{r}&quot;</div>
                  ))}
                </div>
              )}
            </div>
          ))}

        {!loading && postings && postings.length === 0 && (
          <div className="font-mono text-xs text-ink2">No postings yet.</div>
        )}
      </div>
    </div>
  );
}
