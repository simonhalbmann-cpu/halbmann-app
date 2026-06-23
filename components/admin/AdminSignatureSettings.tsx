'use client';

import { collection, doc, onSnapshot, query, setDoc, updateDoc, type DocumentData } from 'firebase/firestore';
import Image from 'next/image';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../lib/firebase';
import { ADMIN_SETTINGS_COLLECTION } from '../../lib/mailboxSettings';
import {
  DEFAULT_EMAIL_SIGNATURE_TEMPLATE_HTML,
  EMAIL_SIGNATURE_SETTINGS_DOC_ID,
  cleanEmailSignatureTemplate,
} from '../../lib/signatureSettings';
import {
  buildFullEmailSignatureHtml,
  buildSignatureAddress,
  cleanSignatureText,
  createSignatureRecord,
  EMAIL_SIGNATURE_TOKENS,
  DEFAULT_SIGNATURE_EMAIL,
  type SignatureRecord,
} from '../../lib/signatures';
import { applyAdminSenderToSignature, resolveAdminSenderContact } from './adminSenderSignature';

type AdminRecord = {
  data: DocumentData;
  id: string;
};

function Field({
  label,
  onChange,
  readOnly = false,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  value: string;
}) {
  return (
    <label className="block">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <input
        className="mt-2 w-full rounded-[18px] border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        value={value}
      />
    </label>
  );
}

function TextAreaField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <textarea
        className="mt-2 min-h-56 w-full rounded-[18px] border border-stone-300 bg-stone-50 px-4 py-3 font-mono text-xs leading-5 text-slate-900 outline-none transition focus:border-amber-700/60"
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        value={value}
      />
    </label>
  );
}

export default function AdminSignatureSettings() {
  const { profile, user } = useAuth();
  const [companies, setCompanies] = useState<AdminRecord[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [form, setForm] = useState<SignatureRecord>(createSignatureRecord());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [globalEmailTemplateHtml, setGlobalEmailTemplateHtml] = useState(DEFAULT_EMAIL_SIGNATURE_TEMPLATE_HTML);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'companies')),
      (snapshot) => {
        const nextCompanies = snapshot.docs
          .map((entry) => ({ data: entry.data(), id: entry.id }))
          .sort((left, right) =>
            cleanSignatureText(left.data.name).localeCompare(cleanSignatureText(right.data.name), 'de')
          );
        setCompanies(nextCompanies);
        setSelectedCompanyId((current) =>
          current && nextCompanies.some((entry) => entry.id === current)
            ? current
            : nextCompanies[0]?.id || ''
        );
      },
      (caughtError) => {
        console.error('Fehler beim Laden der Firmen fÃ¼r Signaturen:', caughtError);
        setError('Die Firmen konnten nicht geladen werden.');
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, ADMIN_SETTINGS_COLLECTION, EMAIL_SIGNATURE_SETTINGS_DOC_ID),
      (snapshot) => {
        setGlobalEmailTemplateHtml(cleanEmailSignatureTemplate(snapshot.data()?.templateHtml));
      },
      (caughtError) => {
        console.error('Fehler beim Laden der E-Mail-Signaturvorlage:', caughtError);
        setError('Die E-Mail-Signaturvorlage konnte nicht geladen werden.');
      }
    );

    return () => unsubscribe();
  }, []);

  const selectedCompany = useMemo(
    () => companies.find((entry) => entry.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  useEffect(() => {
    setForm({
      ...createSignatureRecord(selectedCompany?.data),
      emailTemplateHtml: globalEmailTemplateHtml,
    });
  }, [globalEmailTemplateHtml, selectedCompany]);

  function updateField<K extends keyof SignatureRecord>(field: K, value: SignatureRecord[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function persistSignature(nextForm: SignatureRecord) {
    if (!selectedCompanyId) return;
    await updateDoc(doc(db, 'companies', selectedCompanyId), {
      signatureCity: cleanSignatureText(nextForm.city),
      signatureClosing: cleanSignatureText(nextForm.closing),
      signatureCommercialRegisterNumber: cleanSignatureText(nextForm.commercialRegisterNumber),
      signatureCompanyName: cleanSignatureText(nextForm.companyName),
      signatureCountry: cleanSignatureText(nextForm.country),
      signatureDepartment: cleanSignatureText(nextForm.department),
      signatureEmail: DEFAULT_SIGNATURE_EMAIL,
      signatureFontBold: nextForm.fontBold,
      signatureFontFamily: cleanSignatureText(nextForm.fontFamily),
      signatureFontItalic: nextForm.fontItalic,
      signatureFontSize: cleanSignatureText(nextForm.fontSize),
      signatureFontUnderline: nextForm.fontUnderline,
      signatureHouseNumber: cleanSignatureText(nextForm.houseNumber),
      signatureLegalForm: cleanSignatureText(nextForm.legalForm),
      signatureLogoAlt: cleanSignatureText(nextForm.logoAlt),
      signatureLogoUrl: cleanSignatureText(nextForm.logoUrl),
      signatureManagingDirector: cleanSignatureText(nextForm.managingDirector),
      signatureMobilePhone: cleanSignatureText(nextForm.mobilePhone),
      signatureName: cleanSignatureText(nextForm.name),
      signaturePhone: cleanSignatureText(nextForm.phone),
      signaturePostalCode: cleanSignatureText(nextForm.postalCode),
      signatureRegisterCourt: cleanSignatureText(nextForm.registerCourt),
      signatureRegisteredOffice: cleanSignatureText(nextForm.registeredOffice),
      signatureStreet: cleanSignatureText(nextForm.street),
      signatureTaxNumber: cleanSignatureText(nextForm.taxNumber),
      signatureTextAlign: nextForm.textAlign,
      signatureUseDivider: nextForm.useDivider,
      signatureVatId: cleanSignatureText(nextForm.vatId),
      signatureWebsite: cleanSignatureText(nextForm.website),
    });
  }

  async function persistGlobalEmailTemplate(templateHtml: string) {
    await setDoc(
      doc(db, ADMIN_SETTINGS_COLLECTION, EMAIL_SIGNATURE_SETTINGS_DOC_ID),
      {
        templateHtml: cleanEmailSignatureTemplate(templateHtml),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  function saveSignature() {
    if (!selectedCompanyId) return;
    setMessage('');
    setError('');

    startTransition(async () => {
      try {
        await Promise.all([
          persistSignature(form),
          persistGlobalEmailTemplate(globalEmailTemplateHtml),
        ]);
        setMessage('Signatur wurde gespeichert.');
      } catch (caughtError) {
        console.error('Fehler beim Speichern der Signatur:', caughtError);
        setError('Die Signatur konnte nicht gespeichert werden.');
      }
    });
  }

  function buildStarterEmailTemplate() {
    return DEFAULT_EMAIL_SIGNATURE_TEMPLATE_HTML;
  }

  function updateEmailTemplateHtml(value: string) {
    const nextValue = value;
    setGlobalEmailTemplateHtml(nextValue);
    updateField('emailTemplateHtml', nextValue);
  }

  function insertEmailTemplateToken(token: string) {
    updateEmailTemplateHtml(`${globalEmailTemplateHtml}${globalEmailTemplateHtml ? ' ' : ''}${token}`);
  }

  function clearSignature() {
    if (!selectedCompanyId) return;
    setMessage('');
    setError('');

    startTransition(async () => {
      try {
        const blank = createSignatureRecord(selectedCompany?.data);
        const nextForm = {
          ...blank,
          closing: '',
          department: '',
          emailTemplateHtml: globalEmailTemplateHtml,
          logoAlt: '',
          logoUrl: '',
          mobilePhone: '',
          name: '',
        };
        setForm(nextForm);
        await persistSignature(nextForm);
        setMessage('Signatur wurde gelÃ¶scht.');
      } catch (caughtError) {
        console.error('Fehler beim LÃ¶schen der Signatur:', caughtError);
        setError('Die Signatur konnte nicht gelÃ¶scht werden.');
      }
    });
  }

  async function handleLogoUpload(file?: File | null) {
    if (!selectedCompanyId || !file) return;
    setMessage('');
    setError('');
    setIsUploading(true);

    try {
      const payload = new FormData();
      payload.append('file', file);
      payload.append('companyId', selectedCompanyId);

      const response = await fetch('/api/admin/signature-logo', {
        body: payload,
        method: 'POST',
      });
      const result = (await response.json()) as { error?: string; ok?: boolean; url?: string };
      if (!response.ok || !result.ok || !result.url) {
        throw new Error(result.error || 'logo_upload_failed');
      }

      const nextForm = { ...form, logoUrl: result.url };
      setForm(nextForm);
      await persistSignature(nextForm);
      setMessage('Logo wurde hochgeladen und gespeichert.');
    } catch (caughtError) {
      console.error('Fehler beim Hochladen des Logos:', caughtError);
      setError('Das Logo konnte nicht hochgeladen oder gespeichert werden.');
    } finally {
      setIsUploading(false);
    }
  }

  const previewSignature = applyAdminSenderToSignature(
    form,
    resolveAdminSenderContact(profile, user)
  );
  const address = buildSignatureAddress(previewSignature);
  const emailPreviewHtml = buildFullEmailSignatureHtml(previewSignature);
  const previewStyle = {
    fontFamily: previewSignature.fontFamily,
    fontSize: `${previewSignature.fontSize || '14'}px`,
    fontStyle: previewSignature.fontItalic ? 'italic' : 'normal',
    fontWeight: previewSignature.fontBold ? 700 : 500,
    textAlign: previewSignature.textAlign,
    textDecoration: previewSignature.fontUnderline ? 'underline' : 'none',
    lineHeight: 1.45,
  } as const;

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Signaturen</p>
          <h2 className="mt-2 text-3xl text-slate-950">E-Mail-Signatur</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            Das Layout gilt für alle Firmen. Inhalte, Kontaktdaten und Logos kommen aus den Firmendaten der gewählten Firma.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">Firmen</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Auswahl nur für Inhalte, Logo und Vorschau.
          </p>
          <div className="mt-4 space-y-2">
            {companies.map((company) => (
              <button
                className={`block w-full rounded-[18px] border px-4 py-3 text-left text-sm transition ${
                  selectedCompanyId === company.id
                    ? 'border-amber-300 bg-amber-50 text-slate-950'
                    : 'border-stone-200 bg-white text-slate-700 hover:border-stone-300'
                }`}
                key={company.id}
                onClick={() => setSelectedCompanyId(company.id)}
                type="button"
              >
                {cleanSignatureText(company.data.name) || company.id}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          {!selectedCompany ? (
            <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-slate-600">
              Noch keine Firma vorhanden.
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Abschlussformel" onChange={(value) => updateField('closing', value)} value={form.closing} />
                <Field
                  label="Name"
                  onChange={() => undefined}
                  readOnly
                  value={previewSignature.name}
                />
                <Field label="Firmenname" onChange={(value) => updateField('companyName', value)} value={form.companyName} />
                <Field label="Rechtsform" onChange={(value) => updateField('legalForm', value)} value={form.legalForm} />
                <Field label="Abteilung / Zusatz" onChange={(value) => updateField('department', value)} value={form.department} />
                <Field label="GeschÃ¤ftsfÃ¼hrung" onChange={(value) => updateField('managingDirector', value)} value={form.managingDirector} />
                <Field label="StraÃŸe" onChange={(value) => updateField('street', value)} value={form.street} />
                <Field label="Hausnummer" onChange={(value) => updateField('houseNumber', value)} value={form.houseNumber} />
                <Field label="PLZ" onChange={(value) => updateField('postalCode', value)} value={form.postalCode} />
                <Field label="Ort" onChange={(value) => updateField('city', value)} value={form.city} />
                <Field label="Land" onChange={(value) => updateField('country', value)} value={form.country} />
                <Field label="Sitz der Gesellschaft" onChange={(value) => updateField('registeredOffice', value)} value={form.registeredOffice} />
                <Field
                  label="Mobilfunk"
                  onChange={() => undefined}
                  readOnly
                  value={previewSignature.mobilePhone}
                />
                <Field
                  label="Telefon"
                  onChange={() => undefined}
                  readOnly
                  value={previewSignature.phone}
                />
                <Field
                  label="E-Mail"
                  onChange={() => undefined}
                  readOnly
                  value={DEFAULT_SIGNATURE_EMAIL}
                />
                <Field label="Website" onChange={(value) => updateField('website', value)} value={form.website} />
                <Field label="Registergericht" onChange={(value) => updateField('registerCourt', value)} value={form.registerCourt} />
                <Field label="Handelsregister / Nummer" onChange={(value) => updateField('commercialRegisterNumber', value)} value={form.commercialRegisterNumber} />
                <Field label="Steuernummer" onChange={(value) => updateField('taxNumber', value)} value={form.taxNumber} />
                <Field label="USt-IdNr." onChange={(value) => updateField('vatId', value)} value={form.vatId} />
                <Field label="Logo-Alternativtext" onChange={(value) => updateField('logoAlt', value)} value={form.logoAlt} />
              </div>

              <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Logo</p>
                    <p className="mt-1 text-sm text-slate-600">PNG, JPG, WebP oder SVG hochladen.</p>
                  </div>
                  <label className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400">
                    {isUploading ? 'Logo wird hochgeladen...' : 'Logo auswÃ¤hlen'}
                    <input
                      accept="image/*"
                      className="hidden"
                      disabled={isUploading}
                      onChange={(event) => handleLogoUpload(event.target.files?.[0])}
                      type="file"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
                      Einheitliches E-Mail-Layout
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Diese HTML-Vorlage gilt für alle Firmen. Platzhalter ziehen beim Versand die Daten der jeweils gewählten Firma.
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Logo, Adresse, Geschäftsführer, Registerdaten und Kontaktdaten kommen aus den Firmendaten.
                    </p>
                  </div>
                  <button
                    className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400"
                    onClick={() => updateEmailTemplateHtml(buildStarterEmailTemplate())}
                    type="button"
                  >
                    Startvorlage einsetzen
                  </button>
                </div>

                <div className="mt-4">
                  <TextAreaField
                    label="HTML-Vorlage"
                    onChange={updateEmailTemplateHtml}
                    value={globalEmailTemplateHtml}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {EMAIL_SIGNATURE_TOKENS.map((token) => (
                    <button
                      className="rounded-full border border-stone-300 bg-white px-3 py-1.5 font-mono text-[11px] text-slate-700 transition hover:border-stone-400"
                      key={token}
                      onClick={() => insertEmailTemplateToken(token)}
                      type="button"
                    >
                      {token}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-stone-200 bg-white p-6">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Vorschau</p>

                <div className="mt-5 rounded-[20px] border border-stone-200 bg-stone-50 px-6 py-6 text-slate-700">
                  {previewSignature.emailTemplateHtml && emailPreviewHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: emailPreviewHtml }} />
                  ) : (
                    <>
                  {previewSignature.logoUrl ? (
                    <div className="mb-5 flex justify-center">
                      <Image
                        alt={previewSignature.logoAlt || previewSignature.companyName || 'Logo'}
                        className="h-32 w-auto object-contain"
                        height={128}
                        src={previewSignature.logoUrl}
                        unoptimized
                        width={420}
                      />
                    </div>
                  ) : null}
                  <div
                    className={`${previewSignature.useDivider ? 'border-t border-stone-300 pt-4' : ''}`}
                    style={previewStyle}
                  >
                    <p style={{ margin: 0 }}>{previewSignature.closing || 'Mit freundlichen Grüßen'}</p>
                    {previewSignature.name ? <p className="text-slate-950" style={{ margin: '14px 0 0 0' }}>{previewSignature.name}</p> : null}
                    <p className="text-slate-950" style={{ margin: previewSignature.name ? '6px 0 0 0' : '14px 0 0 0' }}>
                      {[previewSignature.companyName, previewSignature.legalForm].filter(Boolean).join(' · ') || 'Firmenname'}
                    </p>
                    {previewSignature.department ? <p style={{ margin: '4px 0 0 0' }}>{previewSignature.department}</p> : null}
                    {address ? <p className="whitespace-pre-line" style={{ margin: '12px 0 0 0' }}>{address}</p> : null}
                    <div className="text-slate-600" style={{ marginTop: '12px' }}>
                      {previewSignature.registeredOffice ? <p style={{ margin: 0 }}>Sitz: {previewSignature.registeredOffice}</p> : null}
                      {previewSignature.managingDirector ? <p style={{ margin: '2px 0 0 0' }}>GeschÃ¤ftsfÃ¼hrung: {previewSignature.managingDirector}</p> : null}
                      {previewSignature.mobilePhone ? <p style={{ margin: '2px 0 0 0' }}>Mobilfunk: {previewSignature.mobilePhone}</p> : null}
                      {previewSignature.phone ? <p style={{ margin: '2px 0 0 0' }}>Telefon: {previewSignature.phone}</p> : null}
                      {previewSignature.email ? <p style={{ margin: '2px 0 0 0' }}>{previewSignature.email}</p> : null}
                      {previewSignature.website ? <p style={{ margin: '2px 0 0 0' }}>{previewSignature.website}</p> : null}
                      {previewSignature.registerCourt ? <p style={{ margin: '2px 0 0 0' }}>Registergericht: {previewSignature.registerCourt}</p> : null}
                      {previewSignature.commercialRegisterNumber ? <p style={{ margin: '2px 0 0 0' }}>Handelsregister: {previewSignature.commercialRegisterNumber}</p> : null}
                      {previewSignature.taxNumber ? <p style={{ margin: '2px 0 0 0' }}>Steuernummer: {previewSignature.taxNumber}</p> : null}
                      {previewSignature.vatId ? <p style={{ margin: '2px 0 0 0' }}>USt-IdNr.: {previewSignature.vatId}</p> : null}
                    </div>
                  </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  className="rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-5 py-3 text-sm font-medium text-stone-100 transition hover:brightness-105 disabled:opacity-50"
                  disabled={isPending || isUploading}
                  onClick={saveSignature}
                  type="button"
                >
                  {isPending ? 'Wird gespeichert...' : 'Signatur speichern'}
                </button>
                <button
                  className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-medium text-rose-700 transition hover:border-rose-300 disabled:opacity-50"
                  disabled={isPending || isUploading}
                  onClick={clearSignature}
                  type="button"
                >
                  Signatur lÃ¶schen
                </button>
              </div>
            </>
          )}

          {message ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

