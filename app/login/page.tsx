import Link from 'next/link';
import LoginForm from '../../components/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(201,165,107,0.18),_transparent_30%),linear-gradient(180deg,_#f6f1ea_0%,_#f3ede4_100%)] px-6 py-12">
      <div className="mx-auto flex min-h-[80vh] max-w-xl items-center justify-center">
        <div className="w-full rounded-[36px] border border-stone-200 bg-white/92 p-6 shadow-[0_36px_100px_-55px_rgba(15,23,42,0.5)] backdrop-blur sm:p-8">
          <div className="rounded-[28px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,250,240,0.96)_0%,rgba(247,241,231,0.94)_100%)] px-6 py-5 text-slate-900 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-amber-700/80">
                  Verwaltung
                </p>
                <h1 className="mt-3 text-3xl text-slate-950">Verwalter-Login</h1>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Dieser Bereich ist ausschließlich für interne Verwaltungszugänge
                  vorgesehen.
                </p>
              </div>
              <Link
                className="rounded-full border border-stone-300 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400 hover:text-slate-950"
                href="/"
              >
                Home
              </Link>
            </div>
          </div>

          <div className="mt-5 rounded-[28px] border border-stone-200 bg-stone-50 p-6">
            <LoginForm intendedRole="admin" />
          </div>
        </div>
      </div>
    </div>
  );
}
