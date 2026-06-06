import Link from 'next/link';
import LoginForm from '../../components/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(215,185,120,0.12),_transparent_34%),linear-gradient(180deg,_#111820_0%,_#1f1713_54%,_#121820_100%)] px-6 py-12 text-slate-100">
      <div className="mx-auto flex min-h-[80vh] max-w-xl items-center justify-center">
        <div className="w-full rounded-[36px] border border-white/12 bg-white/8 p-6 shadow-[0_36px_100px_-55px_rgba(0,0,0,0.8)] backdrop-blur sm:p-8">
          <div className="rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)] px-6 py-5 text-slate-100 shadow-[0_24px_60px_-38px_rgba(0,0,0,0.65)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[#d7b978]">
                  Verwaltung
                </p>
                <h1 className="mt-3 text-3xl text-white">Verwalter-Login</h1>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Dieser Bereich ist ausschließlich für interne Verwaltungszugänge
                  vorgesehen.
                </p>
              </div>
              <Link
                className="rounded-full border border-white/18 bg-white/8 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-white/35 hover:bg-white/12"
                href="/"
              >
                Home
              </Link>
            </div>
          </div>

          <div className="mt-5 rounded-[28px] border border-white/10 bg-white p-6 text-slate-900 shadow-[0_22px_70px_-48px_rgba(0,0,0,0.85)]">
            <LoginForm intendedRole="admin" />
          </div>
        </div>
      </div>
    </div>
  );
}
