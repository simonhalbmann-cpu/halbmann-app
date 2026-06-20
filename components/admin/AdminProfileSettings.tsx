'use client';

import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState, useTransition } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../lib/firebase';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function Field({
  label,
  onChange,
  placeholder,
  type = 'text',
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="mt-2 w-full rounded-[18px] border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

export default function AdminProfileSettings() {
  const { profile, refreshProfile, user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [mobilePhone, setMobilePhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDisplayName(cleanText(profile?.displayName) || cleanText(user?.displayName));
    setPhone(cleanText(profile?.phone));
    setMobilePhone(cleanText(profile?.mobilePhone));
    setContactEmail(cleanText(profile?.contactEmail));
  }, [profile, user]);

  function saveProfile() {
    if (!user) {
      setError('Sie sind nicht angemeldet.');
      return;
    }

    setMessage('');
    setError('');

    startTransition(async () => {
      try {
        await setDoc(
          doc(db, 'userProfiles', user.uid),
          {
            contactEmail: cleanText(contactEmail),
            displayName: cleanText(displayName),
            mobilePhone: cleanText(mobilePhone),
            phone: cleanText(phone),
            role: 'admin',
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        await refreshProfile();
        setMessage('Profil wurde gespeichert.');
      } catch (caughtError) {
        console.error('Fehler beim Speichern des Verwalterprofils:', caughtError);
        setError('Das Profil konnte nicht gespeichert werden.');
      }
    });
  }

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
          Verwalterprofil
        </p>
        <h2 className="mt-2 text-3xl text-slate-950">Mein Profil</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          Diese Daten werden bei ausgehenden E-Mails und Briefen als Absenderdaten des angemeldeten Verwalters genutzt.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Name" onChange={setDisplayName} placeholder="Vorname Nachname" value={displayName} />
        <Field
          label="Kontakt-E-Mail intern"
          onChange={setContactEmail}
          placeholder={cleanText(user?.email) || 'name@halbmann-holding.de'}
          type="email"
          value={contactEmail}
        />
        <Field label="Telefon" onChange={setPhone} placeholder="+49 30 ..." type="tel" value={phone} />
        <Field label="Mobilfunk" onChange={setMobilePhone} placeholder="+49 ..." type="tel" value={mobilePhone} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          className="rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-5 py-3 text-sm font-medium text-stone-100 transition hover:brightness-105 disabled:opacity-50"
          disabled={isPending || !user}
          onClick={saveProfile}
          type="button"
        >
          {isPending ? 'Wird gespeichert...' : 'Profil speichern'}
        </button>
        <p className="text-sm text-slate-500">
          Login: {cleanText(user?.email) || cleanText(profile?.email) || 'nicht hinterlegt'}
        </p>
      </div>

      {message ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
    </section>
  );
}
