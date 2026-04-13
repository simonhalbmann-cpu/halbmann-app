'use client';

import { collection, doc, onSnapshot, query, updateDoc, type DocumentData } from 'firebase/firestore';
import Image from 'next/image';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { db } from '../../lib/firebase';
import {
  buildSignatureAddress,
  cleanSignatureText,
  createSignatureRecord,
  type SignatureRecord,
} from '../../lib/signatures';

type AdminRecord = {
  data: DocumentData;
  id: string;
};

type TextAlign = 'center' | 'left';

const fontOptions = [
  'Segoe UI, Arial, sans-serif',
  'Arial, Helvetica, sans-serif',
  'Georgia, Times New Roman, serif',
  'Verdana, Geneva, sans-serif',
];

function Field({
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
      <input
        className="mt-2 w-full rounded-[18px] border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function ToggleChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? 'bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] text-stone-100'
          : 'border border-stone-300 bg-white text-slate-700 hover:border-stone-400'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function FormatToolbar({
  align,
  bold,
  divider,
  fontFamily,
  fontSize,
  italic,
  underline,
  onAlignChange,
  onBoldChange,
  onDividerChange,
  onFontFamilyChange,
  onFontSizeChange,
  onItalicChange,
  onUnderlineChange,
}: {
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
        <select
          className="w-full rounded-[18px] border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
          onChange={(event) => onFontFamilyChange(event.target.value)}
          value={fontFamily}
        >
          {fontOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <Field label="Schriftgröße" onChange={onFontSizeChange} value={fontSize} />
      <label className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Ausrichtung</span>
        <select
          className="w-full rounded-[18px] border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
          onChange={(event) => onAlignChange(event.target.value === 'left' ? 'left' : 'center')}
          value={align}
        >
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

export default function AdminSignatureSettings() {
  const [companies, setCompanies] = useState<AdminRecord[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [form, setForm] = useState<SignatureRecord>(createSignatureRecord());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);

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
        console.error('Fehler beim Laden der Firmen für Signaturen:', caughtError);
        setError('Die Firmen konnten nicht geladen werden.');
      }
    );

    return () => unsubscribe();
  }, []);

  const selectedCompany = useMemo(
    () => companies.find((entry) => entry.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  useEffect(() => {
    setForm(createSignatureRecord(selectedCompany?.data));
  }, [selectedCompany]);

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
      signatureEmail: cleanSignatureText(nextForm.email),
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
      signaturePortalClosing: cleanSignatureText(nextForm.portalClosing),
      signaturePortalCompanyName: cleanSignatureText(nextForm.portalCompanyName),
      signaturePortalName: cleanSignatureText(nextForm.portalName),
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

  function saveSignature() {
    if (!selectedCompanyId) return;
    setMessage('');
    setError('');

    startTransition(async () => {
      try {
        await persistSignature(form);
        setMessage('Signatur wurde gespeichert.');
      } catch (caughtError) {
        console.error('Fehler beim Speichern der Signatur:', caughtError);
        setError('Die Signatur konnte nicht gespeichert werden.');
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

  const address = buildSignatureAddress(form);
  const previewStyle = {
    fontFamily: form.fontFamily,
    fontSize: `${form.fontSize || '14'}px`,
    fontStyle: form.fontItalic ? 'italic' : 'normal',
    fontWeight: form.fontBold ? 700 : 500,
    textAlign: form.textAlign,
    textDecoration: form.fontUnderline ? 'underline' : 'none',
    lineHeight: 1.45,
  } as const;

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Signaturen</p>
          <h2 className="mt-2 text-3xl text-slate-950">Firmensignaturen</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            Für jede Firma kann hier eine professionelle E-Mail- und Portal-Signatur gepflegt werden.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">Firmen</p>
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
              <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-5">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Signaturformat</p>
                <div className="mt-4">
                  <FormatToolbar
                    align={form.textAlign}
                    bold={form.fontBold}
                    divider={form.useDivider}
                    fontFamily={form.fontFamily}
                    fontSize={form.fontSize}
                    italic={form.fontItalic}
                    underline={form.fontUnderline}
                    onAlignChange={(value) => updateField('textAlign', value)}
                    onBoldChange={(value) => updateField('fontBold', value)}
                    onDividerChange={(value) => updateField('useDivider', value)}
                    onFontFamilyChange={(value) => updateField('fontFamily', value)}
                    onFontSizeChange={(value) => updateField('fontSize', value)}
                    onItalicChange={(value) => updateField('fontItalic', value)}
                    onUnderlineChange={(value) => updateField('fontUnderline', value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Abschlussformel" onChange={(value) => updateField('closing', value)} value={form.closing} />
                <Field label="Name" onChange={(value) => updateField('name', value)} value={form.name} />
                <Field label="Firmenname" onChange={(value) => updateField('companyName', value)} value={form.companyName} />
                <Field label="Rechtsform" onChange={(value) => updateField('legalForm', value)} value={form.legalForm} />
                <Field label="Abteilung / Zusatz" onChange={(value) => updateField('department', value)} value={form.department} />
                <Field label="Geschäftsführung" onChange={(value) => updateField('managingDirector', value)} value={form.managingDirector} />
                <Field label="Straße" onChange={(value) => updateField('street', value)} value={form.street} />
                <Field label="Hausnummer" onChange={(value) => updateField('houseNumber', value)} value={form.houseNumber} />
                <Field label="PLZ" onChange={(value) => updateField('postalCode', value)} value={form.postalCode} />
                <Field label="Ort" onChange={(value) => updateField('city', value)} value={form.city} />
                <Field label="Land" onChange={(value) => updateField('country', value)} value={form.country} />
                <Field label="Sitz der Gesellschaft" onChange={(value) => updateField('registeredOffice', value)} value={form.registeredOffice} />
                <Field label="Mobilfunk" onChange={(value) => updateField('mobilePhone', value)} value={form.mobilePhone} />
                <Field label="Telefon" onChange={(value) => updateField('phone', value)} value={form.phone} />
                <Field label="E-Mail" onChange={(value) => updateField('email', value)} value={form.email} />
                <Field label="Website" onChange={(value) => updateField('website', value)} value={form.website} />
                <Field label="Registergericht" onChange={(value) => updateField('registerCourt', value)} value={form.registerCourt} />
                <Field label="Handelsregister / Nummer" onChange={(value) => updateField('commercialRegisterNumber', value)} value={form.commercialRegisterNumber} />
                <Field label="Steuernummer" onChange={(value) => updateField('taxNumber', value)} value={form.taxNumber} />
                <Field label="USt-IdNr." onChange={(value) => updateField('vatId', value)} value={form.vatId} />
                <Field label="Portal-Abschluss" onChange={(value) => updateField('portalClosing', value)} value={form.portalClosing} />
                <Field label="Portal-Name" onChange={(value) => updateField('portalName', value)} value={form.portalName} />
                <Field label="Portal-Firmenname" onChange={(value) => updateField('portalCompanyName', value)} value={form.portalCompanyName} />
                <Field label="Logo-Alternativtext" onChange={(value) => updateField('logoAlt', value)} value={form.logoAlt} />
              </div>

              <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Logo</p>
                    <p className="mt-1 text-sm text-slate-600">PNG, JPG, WebP oder SVG hochladen.</p>
                  </div>
                  <label className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400">
                    {isUploading ? 'Logo wird hochgeladen...' : 'Logo auswählen'}
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

              <div className="rounded-[24px] border border-stone-200 bg-white p-6">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Vorschau</p>

                <div className="mt-5 rounded-[20px] border border-stone-200 bg-stone-50 px-6 py-6 text-slate-700">
                  {form.logoUrl ? (
                    <div className="mb-5 flex justify-center">
                      <Image
                        alt={form.logoAlt || form.companyName || 'Logo'}
                        className="h-32 w-auto object-contain"
                        height={128}
                        src={form.logoUrl}
                        unoptimized
                        width={420}
                      />
                    </div>
                  ) : null}
                  <div
                    className={`${form.useDivider ? 'border-t border-stone-300 pt-4' : ''}`}
                    style={previewStyle}
                  >
                    <p style={{ margin: 0 }}>{form.closing || 'Mit freundlichen Grüßen'}</p>
                    {form.name ? <p className="text-slate-950" style={{ margin: '14px 0 0 0' }}>{form.name}</p> : null}
                    <p className="text-slate-950" style={{ margin: form.name ? '6px 0 0 0' : '14px 0 0 0' }}>
                      {[form.companyName, form.legalForm].filter(Boolean).join(' · ') || 'Firmenname'}
                    </p>
                    {form.department ? <p style={{ margin: '4px 0 0 0' }}>{form.department}</p> : null}
                    {address ? <p className="whitespace-pre-line" style={{ margin: '12px 0 0 0' }}>{address}</p> : null}
                    <div className="text-slate-600" style={{ marginTop: '12px' }}>
                      {form.registeredOffice ? <p style={{ margin: 0 }}>Sitz: {form.registeredOffice}</p> : null}
                      {form.managingDirector ? <p style={{ margin: '2px 0 0 0' }}>Geschäftsführung: {form.managingDirector}</p> : null}
                      {form.mobilePhone ? <p style={{ margin: '2px 0 0 0' }}>Mobilfunk: {form.mobilePhone}</p> : null}
                      {form.phone ? <p style={{ margin: '2px 0 0 0' }}>Telefon: {form.phone}</p> : null}
                      {form.email ? <p style={{ margin: '2px 0 0 0' }}>{form.email}</p> : null}
                      {form.website ? <p style={{ margin: '2px 0 0 0' }}>{form.website}</p> : null}
                      {form.registerCourt ? <p style={{ margin: '2px 0 0 0' }}>Registergericht: {form.registerCourt}</p> : null}
                      {form.commercialRegisterNumber ? <p style={{ margin: '2px 0 0 0' }}>Handelsregister: {form.commercialRegisterNumber}</p> : null}
                      {form.taxNumber ? <p style={{ margin: '2px 0 0 0' }}>Steuernummer: {form.taxNumber}</p> : null}
                      {form.vatId ? <p style={{ margin: '2px 0 0 0' }}>USt-IdNr.: {form.vatId}</p> : null}
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-[20px] border border-stone-200 bg-white px-6 py-5 text-slate-700">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">Portal-Signatur</p>
                  <div className="mt-4 text-[13px] leading-5 text-slate-700">
                    <p>{form.portalClosing || 'Mit freundlichen Grüßen'}</p>
                    {form.portalName ? <p className="mt-3 font-medium text-slate-950">{form.portalName}</p> : null}
                    <p className={`${form.portalName ? 'mt-1.5' : 'mt-3'} font-medium text-slate-950`}>
                      {form.portalCompanyName || form.companyName || 'Firmenname'}
                    </p>
                  </div>
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
