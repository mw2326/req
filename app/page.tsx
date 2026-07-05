import Link from 'next/link';

const FEATURES = [
  {
    label: 'Paste',
    title: 'Drop in any posting',
    body: 'Paste a job description and we extract the company, role, and every concrete, screenable requirement — automatically.',
  },
  {
    label: 'Search',
    title: 'See what companies actually ask for',
    body: 'A shared, searchable database built by students like you — search a company, a role, or a skill.',
  },
  {
    label: 'Close the gap',
    title: 'Get project ideas that close it',
    body: 'Set a dream company, see the skills you’re missing, and get AI-generated project ideas that cover multiple gaps at once.',
  },
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink text-white">
      <div className="max-w-[1470px] mx-auto px-5">
        <div className="flex items-center justify-between py-6">
          <div className="flex items-baseline gap-2.5">
            <div className="font-display font-bold text-[22px] tracking-tight">
              RE<span className="text-amber">Q</span>
            </div>
            <div className="font-mono text-xs text-ink2 hidden sm:block">
              {'// requirement intelligence, crowdsourced'}
            </div>
          </div>
          <Link
            href="/login"
            className="font-mono text-[12px] uppercase tracking-wide border border-hairline px-7 py-2 rounded hover:border-ink2"
          >
            Sign in
          </Link>
        </div>

        <div className="py-20 sm:py-28 max-w-[720px]">
          <h1 className="font-display font-bold text-[36px] sm:text-[46px] leading-[1.1] tracking-tight mb-5">
            Stop optimizing GPA. Start closing the <span className="text-amber">gap</span>.
          </h1>
          <p className="text-ink2 text-[15px] sm:text-[16px] leading-relaxed mb-8 max-w-[560px]">
            REQ turns real job postings into a searchable database of what companies actually screen for — then
            shows you exactly which skills stand between you and your dream company, and what to build to close
            it.
          </p>
          <div className="flex items-center gap-3.5 flex-wrap">
            <Link
              href="/login"
              className="font-mono text-[12.5px] uppercase tracking-wide bg-amber text-[#14161b] font-semibold px-6 py-3 rounded"
            >
              Get started
            </Link>
            <div className="font-mono text-[11px] text-ink2">.edu email required — students only</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pb-24 border-t border-hairline pt-14">
          {FEATURES.map((f) => (
            <div key={f.label}>
              <div className="font-mono text-[10.5px] uppercase text-amber tracking-wide mb-2.5">{f.label}</div>
              <div className="font-display font-semibold text-[17px] mb-2">{f.title}</div>
              <p className="text-ink2 text-[13.5px] leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
