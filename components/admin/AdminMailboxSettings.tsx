'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';

type TextAlign = 'center' | 'left';

type FormState = {
  active: boolean;
  imapHost: string;
  imapPassword: string;
  imapPort: string;
  imapUser: string;
  inboxEmail: string;
  mailFooterBold: boolean;
  mailFooterDivider: boolean;
  mailFooterFontFamily: string;
  mailFooterFontSize: string;
  mailFooterItalic: boolean;
  mailFooterText: string;
  mailFooterTextAlign: TextAlign;
  mailFooterUnderline: boolean;
  mailHeaderBold: boolean;
  mailHeaderDivider: boolean;
  mailHeaderFontFamily: string;
  mailHeaderFontSize: string;
  mailHeaderItalic: boolean;
  mailHeaderText: string;
  mailHeaderTextAlign: TextAlign;
  mailHeaderUnderline: boolean;
  smtpHost: string;
  smtpPassword: string;
  smtpPort: string;
  smtpUser: string;
};

type MailboxSettingsApiResponse = {
  error?: string;
  exists?: boolean;
  ok?: boolean;
  settings?: Partial<FormState>;
};

const fontOptions = [
  'Segoe UI, Arial, sans-serif',
  'Arial, Helvetica, sans-serif',
  'Georgia, Times New Roman, serif',
  'Verdana, Geneva, sans-serif',
];

const defaultValues: FormState = {
  active: true,
  imapHost: 'imap.ionos.de',
  imapPassword: '',
  imapPort: '993',
  imapUser: '',
  inboxEmail: '',
  mailFooterBold: false,
  mailFooterDivider: true,
  mailFooterFontFamily: fontOptions[0],
  mailFooterFontSize: '12',
  mailFooterItalic: false,
  mailFooterText: '',
  mailFooterTextAlign: 'center',
  mailFooterUnderline: false,
  mailHeaderBold: false,
  mailHeaderDivider: true,
  mailHeaderFontFamily: fontOptions[0],
  mailHeaderFontSize: '14',
  mailHeaderItalic: false,
  mailHeaderText: 'Holen Sie sich die App oder nutzen Sie das Online-Mieterportal f?r ein besseres Erlebnis.',
  mailHeaderTextAlign: 'center',
  mailHeaderUnderline: false,
  smtpHost: 'smtp.ionos.de',
  smtpPassword: '',
  smtpPort: '587',
  smtpUser: '',
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function mapSettingsToForm(data?: Partial<FormState> | null): FormState {
  return {
    active: data?.active !== false,
    imapHost: cleanText(data?.imapHost) || defaultValues.imapHost,
    imapPassword: cleanText(data?.imapPassword),
    imapPort: cleanText(data?.imapPort) || defaultValues.imapPort,
    imapUser: cleanText(data?.imapUser),
    inboxEmail: cleanText(data?.inboxEmail),
    mailFooterBold: data?.mailFooterBold === true,
    mailFooterDivider: data?.mailFooterDivider !== false,
    mailFooterFontFamily: cleanText(data?.mailFooterFontFamily) || defaultValues.mailFooterFontFamily,
    mailFooterFontSize: cleanText(data?.mailFooterFontSize) || defaultValues.mailFooterFontSize,
    mailFooterItalic: data?.mailFooterItalic === true,
    mailFooterText: cleanText(data?.mailFooterText),
    mailFooterTextAlign: data?.mailFooterTextAlign === 'left' ? 'left' : 'center',
    mailFooterUnderline: data?.mailFooterUnderline === true,
    mailHeaderBold: data?.mailHeaderBold === true,
    mailHeaderDivider: data?.mailHeaderDivider !== false,
    mailHeaderFontFamily: cleanText(data?.mailHeaderFontFamily) || defaultValues.mailHeaderFontFamily,
    mailHeaderFontSize: cleanText(data?.mailHeaderFontSize) || defaultValues.mailHeaderFontSize,
    mailHeaderItalic: data?.mailHeaderItalic === true,
    mailHeaderText: cleanText(data?.mailHeaderText) || defaultValues.mailHeaderText,
    mailHeaderTextAlign: data?.mailHeaderTextAlign === 'left' ? 'left' : 'center',
    mailHeaderUnderline: data?.mailHeaderUnderline === true,
    smtpHost: cleanText(data?.smtpHost) || defaultValues.smtpHost,
    smtpPassword: cleanText(data?.smtpPassword),
    smtpPort: cleanText(data?.smtpPort) || defaultValues.smtpPort,
    smtpUser: cleanText(data?.smtpUser),
  };
}

function toGermanError(error: string) {
  switch (error) {
    case 'missing_auth_token':
      return 'Die Sitzung ist nicht mehr g?ltig. Bitte melde dich neu an.';
    case 'admin_required':
      return 'Nur Verwalter k?nnen diese Einstellungen ?ndern.';
    default:
      return error || 'Die Einstellungen konnten nicht gespeichert werden.';
  }
}

export default function AdminMailboxSettings({ mode = 'full' }: { mode?: 'credentials' | 'layout' | 'full' }) {
  const { role, user } = useAuth();
  const [form, setForm] = useState<FormState>(defaultValues);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showImapPassword, setShowImapPassword] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function authorizedFetch(url: string, init?: RequestInit) {
    if (!user) throw new Error('missing_auth_token');
    const token = await user.getIdToken();
    return fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
  }

  async function loadSettings() {
    if (!user || role !== 'admin') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await authorizedFetch('/api/admin/mailbox-settings', { method: 'GET' });
      const result = (await response.json()) as MailboxSettingsApiResponse;
      if (!response.ok || !result.ok) throw new Error(result.error || 'mailbox_settings_load_failed');
      setExists(Boolean(result.exists));
      setForm(mapSettingsToForm(result.settings));
    } catch (caughtError) {
      console.error('Fehler beim Laden der Mailbox-Einstellungen:', caughtError);
      setError(toGermanError(caughtError instanceof Error ? caughtError.message : 'Die Einstellungen konnten nicht geladen werden.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, [role, user]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    startTransition(async () => {
      try {
        const response = await authorizedFetch('/api/admin/mailbox-settings', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        const result = (await response.json()) as MailboxSettingsApiResponse;
        if (!response.ok || !result.ok) throw new Error(result.error || 'mailbox_settings_save_failed');
        setExists(Boolean(result.exists));
        setForm(mapSettingsToForm(result.settings));
        setMessage('Postfach wurde gespeichert.');
      } catch (caughtError) {
        console.error('Fehler beim Speichern der Mailbox-Einstellungen:', caughtError);
        setError(toGermanError(caughtError instanceof Error ? caughtError.message : 'Die Einstellungen konnten nicht gespeichert werden.'));
      }
    });
  }

  function handleDelete() {
    setMessage('');
    setError('');
    startTransition(async () => {
      try {
        const response = await authorizedFetch('/api/admin/mailbox-settings', { method: 'DELETE' });
        const result = (await response.json()) as MailboxSettingsApiResponse;
        if (!response.ok || !result.ok) throw new Error(result.error || 'mailbox_settings_delete_failed');
        setExists(false);
        setForm(mapSettingsToForm(result.settings));
        setMessage('Postfach-Einstellungen wurden gel?scht.');
      } catch (caughtError) {
        console.error('Fehler beim L?schen der Mailbox-Einstellungen:', caughtError);
        setError(toGermanError(caughtError instanceof Error ? caughtError.message : 'Die Einstellungen konnten nicht gel?scht werden.'));
      }
    });
  }

  const showCredentialSection = mode !== 'layout';
  const showLayoutSections = mode !== 'credentials';

  const isLayoutOnly = mode === 'layout';
  const sectionTitle = isLayoutOnly ? 'Header und Footer' : 'E-Mail-Eingang und Versand';
  const sectionDescription = isLayoutOnly
    ? 'Hier pflegst du ausschließlich Mail-Header und Mail-Footer für ausgehende Nachrichten.'
    : 'Hier pflegst du Postfach, Header, Footer und die grundlegende Darstellung ausgehender E-Mails separat.';

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
              {isLayoutOnly ? 'Mail-Layout' : 'Globales Postfach'}
            </p>
            <h2 className="mt-2 text-3xl text-slate-950">{sectionTitle}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              {sectionDescription}
            </p>
          </div>
          {!isLayoutOnly ? (
          <div className="rounded-[18px] border border-stone-200 bg-stone-50 px-4 py-3 text-xs leading-6 text-slate-600">
            <div className="font-medium text-slate-900">{exists ? 'Konfiguration vorhanden' : 'Noch keine Konfiguration'}</div>
            <div>IMAP: {form.imapHost}:{form.imapPort}</div>
            <div>SMTP: {form.smtpHost}:{form.smtpPort}</div>
          </div>
          ) : null}
        </div>

        <form className="mt-6 space-y-6" onSubmit={handleSave}>
          {!isLayoutOnly ? (
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
              <label className="flex items-center gap-3 text-sm text-slate-700">
                <input
                  checked={form.active}
                  className="h-4 w-4 rounded border-stone-300 text-slate-900 focus:ring-amber-700/30"
                  onChange={(event) => updateField('active', event.target.checked)}
                  type="checkbox"
                />
                Postfach aktiv verwenden
              </label>
            </div>
          ) : null}

          {showCredentialSection ? (
          <SectionCard title="Zugangsdaten">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="E-Mail-Adresse" value={form.inboxEmail} onChange={(value) => updateField('inboxEmail', value)} />
              <Field label="IMAP-Benutzer" value={form.imapUser} onChange={(value) => updateField('imapUser', value)} />
              <Field label="IMAP-Host" value={form.imapHost} onChange={(value) => updateField('imapHost', value)} />
              <Field label="IMAP-Port" value={form.imapPort} onChange={(value) => updateField('imapPort', value)} />
              <PasswordField label="IMAP-Passwort" value={form.imapPassword} onChange={(value) => updateField('imapPassword', value)} showPassword={showImapPassword} onToggle={() => setShowImapPassword((current) => !current)} />
              <Field label="SMTP-Benutzer" value={form.smtpUser} onChange={(value) => updateField('smtpUser', value)} />
              <Field label="SMTP-Host" value={form.smtpHost} onChange={(value) => updateField('smtpHost', value)} />
              <Field label="SMTP-Port" value={form.smtpPort} onChange={(value) => updateField('smtpPort', value)} />
              <PasswordField label="SMTP-Passwort" value={form.smtpPassword} onChange={(value) => updateField('smtpPassword', value)} showPassword={showSmtpPassword} onToggle={() => setShowSmtpPassword((current) => !current)} />
            </div>
          </SectionCard>
          ) : null}

          {showLayoutSections ? (
          <SectionCard title="Mail-Header">
            <FormatToolbar
              align={form.mailHeaderTextAlign}
              bold={form.mailHeaderBold}
              divider={form.mailHeaderDivider}
              fontFamily={form.mailHeaderFontFamily}
              fontSize={form.mailHeaderFontSize}
              italic={form.mailHeaderItalic}
              underline={form.mailHeaderUnderline}
              onAlignChange={(value) => updateField('mailHeaderTextAlign', value)}
              onBoldChange={(value) => updateField('mailHeaderBold', value)}
              onDividerChange={(value) => updateField('mailHeaderDivider', value)}
              onFontFamilyChange={(value) => updateField('mailHeaderFontFamily', value)}
              onFontSizeChange={(value) => updateField('mailHeaderFontSize', value)}
              onItalicChange={(value) => updateField('mailHeaderItalic', value)}
              onUnderlineChange={(value) => updateField('mailHeaderUnderline', value)}
            />
            <textarea
              className="mt-4 min-h-[120px] w-full rounded-[18px] border border-stone-300 bg-stone-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => updateField('mailHeaderText', event.target.value)}
              placeholder="Kurzer Hinweis oberhalb jeder ausgehenden E-Mail"
              value={form.mailHeaderText}
            />
          </SectionCard>
          ) : null}

          {showLayoutSections ? (
          <SectionCard title="Mail-Footer">
            <FormatToolbar
              align={form.mailFooterTextAlign}
              bold={form.mailFooterBold}
              divider={form.mailFooterDivider}
              fontFamily={form.mailFooterFontFamily}
              fontSize={form.mailFooterFontSize}
              italic={form.mailFooterItalic}
              underline={form.mailFooterUnderline}
              onAlignChange={(value) => updateField('mailFooterTextAlign', value)}
              onBoldChange={(value) => updateField('mailFooterBold', value)}
              onDividerChange={(value) => updateField('mailFooterDivider', value)}
              onFontFamilyChange={(value) => updateField('mailFooterFontFamily', value)}
              onFontSizeChange={(value) => updateField('mailFooterFontSize', value)}
              onItalicChange={(value) => updateField('mailFooterItalic', value)}
              onUnderlineChange={(value) => updateField('mailFooterUnderline', value)}
            />
            <textarea
              className="mt-4 min-h-[120px] w-full rounded-[18px] border border-stone-300 bg-stone-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-700/60"
              onChange={(event) => updateField('mailFooterText', event.target.value)}
              placeholder="Optionaler Footer unterhalb der Signatur"
              value={form.mailFooterText}
            />
          </SectionCard>
          ) : null}

          {loading ? <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-slate-600">Einstellungen werden geladen...</div> : null}
          {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-6 text-slate-500">IONOS Standardwerte: IMAP `imap.ionos.de:993`, SMTP `smtp.ionos.de:587`</p>
            <div className="flex flex-wrap gap-3">
              <button className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-rose-300 hover:text-rose-700 disabled:opacity-50" disabled={isPending || loading || !exists} onClick={handleDelete} type="button">L?schen</button>
              <button className="rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-5 py-3 text-sm font-medium text-stone-100 transition hover:brightness-105 disabled:opacity-50" disabled={isPending || loading} type="submit">{isPending ? 'Wird gespeichert...' : 'Speichern'}</button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function SectionCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">{title}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input className="w-full rounded-[18px] border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  );
}

function PasswordField({ label, onChange, onToggle, showPassword, value }: { label: string; onChange: (value: string) => void; onToggle: () => void; showPassword: boolean; value: string }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex items-center gap-2">
        <input className="w-full rounded-[18px] border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => onChange(event.target.value)} type={showPassword ? 'text' : 'password'} value={value} />
        <button className="shrink-0 rounded-full border border-stone-300 bg-white px-4 py-3 text-xs font-medium text-slate-700 transition hover:border-amber-700/30 hover:text-slate-950" onClick={onToggle} type="button">{showPassword ? 'Verbergen' : 'Anzeigen'}</button>
      </div>
    </label>
  );
}

function FormatToolbar({ align, bold, divider, fontFamily, fontSize, italic, underline, onAlignChange, onBoldChange, onDividerChange, onFontFamilyChange, onFontSizeChange, onItalicChange, onUnderlineChange }: {
  align: TextAlign;
  bold: boolean;
  divider: boolean;
  fontFamily: string;
  fontSize: string;
  italic: boolean;
  underline: boolean;
  onAlignChange: (value: TextAlign) => void;
  onBoldChange: (value: boolean) => void;
  onDividerChange: (value: boolean) => void;
  onFontFamilyChange: (value: string) => void;
  onFontSizeChange: (value: string) => void;
  onItalicChange: (value: boolean) => void;
  onUnderlineChange: (value: boolean) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_120px_120px]">
      <label className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Schriftart</span>
        <select className="w-full rounded-[18px] border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => onFontFamilyChange(event.target.value)} value={fontFamily}>
          {fontOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <Field label="Schriftgr??e" onChange={onFontSizeChange} value={fontSize} />
      <label className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Ausrichtung</span>
        <select className="w-full rounded-[18px] border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60" onChange={(event) => onAlignChange((event.target.value === 'left' ? 'left' : 'center'))} value={align}>
          <option value="center">Zentriert</option>
          <option value="left">Links</option>
        </select>
      </label>
      <div className="flex flex-wrap gap-2 lg:col-span-3">
        <ToggleChip active={bold} label="Fett" onClick={() => onBoldChange(!bold)} />
        <ToggleChip active={italic} label="Kursiv" onClick={() => onItalicChange(!italic)} />
        <ToggleChip active={underline} label="Unterstreichen" onClick={() => onUnderlineChange(!underline)} />
        <ToggleChip active={divider} label="Trennlinie" onClick={() => onDividerChange(!divider)} />
      </div>
    </div>
  );
}

function ToggleChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button className={`rounded-full px-4 py-2 text-sm font-medium transition ${active ? 'bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] text-stone-100' : 'border border-stone-300 bg-white text-slate-700 hover:border-stone-400'}`} onClick={onClick} type="button">{label}</button>;
}
