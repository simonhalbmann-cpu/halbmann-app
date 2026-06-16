'use client';

import { doc, onSnapshot, query, collection, serverTimestamp, updateDoc, type DocumentData } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db, storage } from '../../lib/firebase';
import type { WorkflowRecord } from '../../lib/adminWorkflow';
import { sanitizeStorageFileName, type TenantDocumentEntry } from '../../lib/tenantDocuments';

type HandoverKind = 'moveIn' | 'moveOut';
type DynamicRow = {
  count?: string;
  id: string;
  label: string;
  meterNumber?: string;
  value: string;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function createClientId(prefix = 'id') {
  const randomSource = globalThis.crypto as Crypto | undefined;
  if (typeof randomSource?.randomUUID === 'function') {
    return randomSource.randomUUID();
  }
  const randomPart =
    typeof randomSource?.getRandomValues === 'function'
      ? Array.from(randomSource.getRandomValues(new Uint32Array(2)))
          .map((entry) => entry.toString(36))
          .join('')
      : Math.random().toString(36).slice(2);
  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}

function readCollection(
  name: string,
  onError: (message: string) => void,
  setState: (value: WorkflowRecord[]) => void
) {
  return onSnapshot(
    query(collection(db, name)),
    (snapshot) => setState(snapshot.docs.map((entry) => ({ data: entry.data(), id: entry.id }))),
    (caughtError) => {
      console.error(`Fehler beim Laden von ${name}:`, caughtError);
      onError(`Daten aus ${name} konnten nicht geladen werden.`);
    }
  );
}

function buildTenantName(tenant: DocumentData | null) {
  if (!tenant) return '';
  return (
    [cleanText(tenant.lastName), cleanText(tenant.firstName)].filter(Boolean).join(', ') ||
    cleanText(tenant.companyName) ||
    cleanText(tenant.email)
  );
}

function unitDisplayLabel(unit: DocumentData | null | undefined, fallback: unknown) {
  if (!unit) return cleanText(fallback);
  return (
    [cleanText(unit.unitLabel), cleanText(unit.floor), cleanText(unit.unitPosition), cleanText(unit.section)]
      .filter(Boolean)
      .join(' · ') || cleanText(fallback)
  );
}

export default function TenantHandoverWorkspace({
  initialKind,
  tenantId,
}: {
  initialKind: HandoverKind;
  tenantId: string;
}) {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<DocumentData | null>(null);
  const [properties, setProperties] = useState<WorkflowRecord[]>([]);
  const [companies, setCompanies] = useState<WorkflowRecord[]>([]);
  const [kind, setKind] = useState<HandoverKind>(initialKind);
  const [form, setForm] = useState({
    defects: '',
    notes: '',
    place: '',
    tenantSignatureName: '',
    landlordName: '',
  });
  const [meterRows, setMeterRows] = useState<DynamicRow[]>([]);
  const [keyRows, setKeyRows] = useState<DynamicRow[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const unsubscribeTenant = onSnapshot(
      doc(db, 'tenants', tenantId),
      (snapshot) => setTenant(snapshot.exists() ? snapshot.data() : null),
      (caughtError) => {
        console.error(`Fehler beim Laden des Mieters ${tenantId}:`, caughtError);
        setError('Mieter konnte nicht geladen werden.');
      }
    );
    const unsubscribeProperties = readCollection('properties', setError, setProperties);
    const unsubscribeCompanies = readCollection('companies', setError, setCompanies);
    return () => {
      unsubscribeTenant();
      unsubscribeProperties();
      unsubscribeCompanies();
    };
  }, [tenantId]);

  const selectedProperty = useMemo(
    () => properties.find((entry) => entry.id === cleanText(tenant?.propertyId)) ?? null,
    [properties, tenant?.propertyId]
  );
  const selectedUnit = useMemo(() => {
    const units = Array.isArray(selectedProperty?.data.units)
      ? (selectedProperty.data.units as DocumentData[])
      : [];
    return units.find((unit) => cleanText(unit.id) === cleanText(tenant?.unitId)) ?? null;
  }, [selectedProperty?.data.units, tenant?.unitId]);
  const selectedCompany = useMemo(
    () =>
      companies.find((entry) => entry.id === cleanText(selectedProperty?.data.ownerId)) ??
      companies.find((entry) => entry.id === cleanText(tenant?.companyId)) ??
      null,
    [companies, selectedProperty?.data.ownerId, tenant?.companyId]
  );
  const tenantName = buildTenantName(tenant);
  const unitLabel = unitDisplayLabel(selectedUnit, tenant?.unitLabel);
  const objectAddress = [
    [cleanText(selectedProperty?.data.street), cleanText(selectedProperty?.data.houseNumber)].filter(Boolean).join(' '),
    [cleanText(selectedProperty?.data.postalCode), cleanText(selectedProperty?.data.city)].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ');

  useEffect(() => {
    setForm((current) => ({
      ...current,
      landlordName: current.landlordName || cleanText(selectedCompany?.data.name) || cleanText(selectedCompany?.data.companyName),
      place: current.place || [objectAddress, unitLabel].filter(Boolean).join(' · '),
      tenantSignatureName: current.tenantSignatureName || tenantName,
    }));
  }, [objectAddress, selectedCompany?.data.companyName, selectedCompany?.data.name, tenantName, unitLabel]);

  useEffect(() => {
    const unitMeters = Array.isArray(selectedUnit?.meters) ? (selectedUnit!.meters as DocumentData[]) : [];
    setMeterRows(
      unitMeters.map((meter, index) => ({
        id: cleanText(meter.id) || `meter-${index}`,
        label: cleanText(meter.label || meter.meterType || meter.type) || `Zähler ${index + 1}`,
        meterNumber: cleanText(meter.meterNumber),
        value: '',
      }))
    );
    const unitKeys = Array.isArray(selectedUnit?.keys) ? (selectedUnit!.keys as DocumentData[]) : [];
    setKeyRows(
      unitKeys.map((entry, index) => ({
        count: cleanText(entry.count),
        id: cleanText(entry.id) || `key-${index}`,
        label: cleanText(entry.label) || `Schlüssel ${index + 1}`,
        value: cleanText(entry.count),
      }))
    );
  }, [selectedUnit]);

  function updateForm(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateMeterRow(id: string, field: keyof DynamicRow, value: string) {
    setMeterRows((current) => current.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry)));
  }

  function updateKeyRow(id: string, field: keyof DynamicRow, value: string) {
    setKeyRows((current) => current.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry)));
  }

  function addMeterRow() {
    setMeterRows((current) => [...current, { id: createClientId('meter'), label: '', meterNumber: '', value: '' }]);
  }

  function addKeyRow() {
    setKeyRows((current) => [...current, { count: '', id: createClientId('key'), label: '', value: '' }]);
  }

  function buildProtocolHtml(protocolId: string) {
    const title = kind === 'moveIn' ? 'Übergabeprotokoll Einzug' : 'Übergabeprotokoll Auszug';
    const tableRows = (rows: string[]) => rows.join('');
    const escapeHtml = (value: unknown) =>
      cleanText(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;line-height:1.5;color:#111827;padding:32px}h1{font-size:24px}h2{font-size:16px;margin-top:28px}table{width:100%;border-collapse:collapse;margin-top:8px}td,th{border:1px solid #d6d3d1;padding:8px;text-align:left;vertical-align:top}.muted{color:#64748b}.box{white-space:pre-wrap;border:1px solid #d6d3d1;padding:12px;min-height:64px}</style></head><body><h1>${escapeHtml(title)}</h1><p class="muted">Protokoll-ID: ${escapeHtml(protocolId)} · ${escapeHtml(new Date().toLocaleString('de-DE'))}</p><table><tbody><tr><th>Ort / Treffpunkt</th><td>${escapeHtml(form.place)}</td></tr><tr><th>Mieter</th><td>${escapeHtml(form.tenantSignatureName)}</td></tr><tr><th>Vermieter</th><td>${escapeHtml(form.landlordName)}</td></tr><tr><th>Objekt</th><td>${escapeHtml(cleanText(selectedProperty?.data.name) || objectAddress)}</td></tr><tr><th>Einheit</th><td>${escapeHtml(unitLabel)}</td></tr></tbody></table><h2>Mängel / offene Punkte</h2><div class="box">${escapeHtml(form.defects) || 'Keine Angaben'}</div><h2>Zählerstände</h2><table><thead><tr><th>Bezeichnung</th><th>Zählernummer</th><th>Stand</th></tr></thead><tbody>${tableRows(meterRows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.meterNumber)}</td><td>${escapeHtml(row.value)}</td></tr>`))}</tbody></table><h2>Schlüssel</h2><table><thead><tr><th>Bezeichnung</th><th>Soll</th><th>Übergabe</th></tr></thead><tbody>${tableRows(keyRows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.count)}</td><td>${escapeHtml(row.value)}</td></tr>`))}</tbody></table><h2>Notizen</h2><div class="box">${escapeHtml(form.notes) || 'Keine Angaben'}</div></body></html>`;
  }

  function buildProtocolBody(protocolId: string) {
    return [
      `Protokoll-ID: ${protocolId}`,
      `Art: ${kind === 'moveIn' ? 'Einzug' : 'Auszug'}`,
      `Ort / Treffpunkt: ${form.place}`,
      `Mieter: ${form.tenantSignatureName}`,
      `Vermieter: ${form.landlordName}`,
      `Objekt: ${cleanText(selectedProperty?.data.name) || objectAddress}`,
      `Einheit: ${unitLabel}`,
      '',
      'Mängel / offene Punkte:',
      form.defects || 'Keine Angaben',
      '',
      'Zählerstände:',
      ...(meterRows.length
        ? meterRows.map((row) => `${row.label || 'Zähler'}${row.meterNumber ? ` (${row.meterNumber})` : ''}: ${row.value || '-'}`)
        : ['Keine Zähler erfasst.']),
      '',
      'Schlüssel:',
      ...(keyRows.length
        ? keyRows.map((row) => `${row.label || 'Schlüssel'}: Soll ${row.count || '-'}, Übergabe ${row.value || '-'}`)
        : ['Keine Schlüssel erfasst.']),
      '',
      'Notizen:',
      form.notes || 'Keine Angaben',
    ].join('\n');
  }

  async function createProtocolDocument(protocolId: string) {
    const subject = kind === 'moveIn' ? 'Übergabeprotokoll Einzug' : 'Übergabeprotokoll Auszug';
    const templateUrl = cleanText(
      kind === 'moveIn'
        ? selectedCompany?.data.handoverMoveInTemplateUrl
        : selectedCompany?.data.handoverMoveOutTemplateUrl
    );
    const baseName = `${subject} ${tenantName || tenantId}`;
    const body = buildProtocolBody(protocolId);

    if (templateUrl && user) {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/letter-documents', {
        body: JSON.stringify({
          fileName: baseName,
          replacements: {
            BODY: body,
            CLOSING: '',
            COMPANY_NAME: cleanText(selectedCompany?.data.name) || cleanText(selectedCompany?.data.companyName),
            RECIPIENT_ADDRESS: form.place,
            RECIPIENT_COMPANY: '',
            RECIPIENT_NAME: form.tenantSignatureName,
            RECIPIENT_SALUTATION: '',
            SENDER_NAME: form.landlordName,
            SUBJECT: subject,
            SUBJECT_LINE_2: [cleanText(selectedProperty?.data.name) || objectAddress, unitLabel].filter(Boolean).join(' · '),
          },
          templateUrl,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });
      if (response.ok) {
        return {
          blob: await response.blob(),
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          name: `${baseName}.docx`,
        };
      }
    }

    return {
      blob: new Blob([buildProtocolHtml(protocolId)], { type: 'text/html;charset=utf-8' }),
      contentType: 'text/html',
      name: `${baseName}.html`,
    };
  }

  async function uploadDocumentBlob(blob: Blob, name: string, contentType: string) {
    const storagePath = `tenant-documents/${tenantId}/handover/${Date.now()}-${createClientId('file')}-${sanitizeStorageFileName(name)}`;
    const uploadResult = await uploadBytes(ref(storage, storagePath), blob, { contentType });
    const url = await getDownloadURL(uploadResult.ref);
    return {
      category: 'Übergabe',
      contentType,
      name,
      path: storagePath,
      size: blob.size,
      source: 'handover-protocol',
      uploadedAt: new Date().toISOString(),
      uploadedByEmail: user?.email ?? '',
      url,
    } satisfies TenantDocumentEntry;
  }

  async function uploadProtocolFiles(protocolId: string) {
    const uploaded: TenantDocumentEntry[] = [];
    for (const file of files) {
      uploaded.push(await uploadDocumentBlob(file, `${protocolId}-${file.name}`, file.type || 'application/octet-stream'));
    }
    return uploaded;
  }

  function saveProtocol() {
    if (!tenant) return;
    const hasContent = Object.values(form).some((value) => cleanText(value));
    if (!hasContent) {
      setError('Bitte mindestens eine Angabe für das Übergabeprotokoll eintragen.');
      return;
    }

    startTransition(async () => {
      try {
        setError('');
        setMessage('');
        const protocolId = `uebergabe-${Date.now()}`;
        const generatedProtocol = await createProtocolDocument(protocolId);
        const protocolDocument = await uploadDocumentBlob(
          generatedProtocol.blob,
          generatedProtocol.name,
          generatedProtocol.contentType
        );
        const uploadedFiles = await uploadProtocolFiles(protocolId);
        const currentProtocols = Array.isArray(tenant.handoverProtocols)
          ? tenant.handoverProtocols
          : [];
        const currentDocuments = Array.isArray(tenant.tenantDocuments)
          ? tenant.tenantDocuments
          : [];
        await updateDoc(doc(db, 'tenants', tenantId), {
          handoverProtocols: [
            ...currentProtocols,
            {
              ...form,
              attachments: uploadedFiles,
              createdAt: new Date().toISOString(),
              createdByEmail: user?.email ?? null,
              kind,
              keys: keyRows,
              meters: meterRows,
              protocolDocument,
              protocolId,
              propertyId: cleanText(tenant.propertyId),
              propertyName: cleanText(selectedProperty?.data.name),
              unitId: cleanText(tenant.unitId),
              unitLabel,
            },
          ],
          tenantDocuments: [...currentDocuments, protocolDocument, ...uploadedFiles],
          updatedAt: serverTimestamp(),
          updatedByEmail: user?.email ?? null,
          updatedByUid: user?.uid ?? null,
        });
        setForm({
          defects: '',
          landlordName: cleanText(selectedCompany?.data.name) || cleanText(selectedCompany?.data.companyName),
          notes: '',
          place: [objectAddress, unitLabel].filter(Boolean).join(' · '),
          tenantSignatureName: tenantName,
        });
        setFiles([]);
        setMessage('Übergabeprotokoll wurde gespeichert.');
      } catch (caughtError) {
        console.error('Fehler beim Speichern des Übergabeprotokolls:', caughtError);
        setError('Das Übergabeprotokoll konnte nicht gespeichert werden.');
      }
    });
  }

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            className="inline-flex rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400"
            href={`/admin/mieter/${tenantId}`}
          >
            Zurück zum Mieter
          </Link>
          <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
            Übergabe
          </p>
          <h1 className="mt-2 break-words text-3xl text-slate-950">
            {kind === 'moveIn' ? 'Einzug' : 'Auszug'}
          </h1>
          <p className="mt-2 break-words text-sm leading-6 text-slate-600">
            {[tenantName, cleanText(selectedProperty?.data.name), unitLabel].filter(Boolean).join(' · ')}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-2 text-sm text-slate-700">
          <span>Art</span>
          <select
            className="bg-transparent text-sm text-slate-900 outline-none"
            onChange={(event) => setKind(event.target.value === 'moveOut' ? 'moveOut' : 'moveIn')}
            value={kind}
          >
            <option value="moveIn">Einzug</option>
            <option value="moveOut">Auszug</option>
          </select>
        </label>
      </div>

      <section className="min-w-0 overflow-x-hidden rounded-[24px] border border-stone-200 bg-white p-4 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)] sm:p-6">
        <div className="grid min-w-0 gap-4">
          <input
            className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            onChange={(event) => updateForm('place', event.target.value)}
            placeholder="Ort / Treffpunkt"
            value={form.place}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              onChange={(event) => updateForm('tenantSignatureName', event.target.value)}
              placeholder="Name Mieter / Übergabepartner"
              value={form.tenantSignatureName}
            />
            <input
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              onChange={(event) => updateForm('landlordName', event.target.value)}
              placeholder="Vermieter"
              value={form.landlordName}
            />
          </div>
          <textarea
            className="min-h-28 rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            onChange={(event) => updateForm('defects', event.target.value)}
            placeholder="Mängel / offene Punkte"
            value={form.defects}
          />
          <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-950">Zählerstände</p>
              <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700" onClick={addMeterRow} type="button">
                + Zähler
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {meterRows.map((row) => (
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px]" key={row.id}>
                  <input className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none" onChange={(event) => updateMeterRow(row.id, 'label', event.target.value)} placeholder="Zählerbezeichnung" value={row.label} />
                  <input className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none" onChange={(event) => updateMeterRow(row.id, 'meterNumber', event.target.value)} placeholder="Zählernummer" value={row.meterNumber || ''} />
                  <input className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none" onChange={(event) => updateMeterRow(row.id, 'value', event.target.value)} placeholder="Stand" value={row.value} />
                </div>
              ))}
              {meterRows.length === 0 ? <p className="text-sm text-slate-600">Keine Zähler an der Einheit hinterlegt.</p> : null}
            </div>
          </div>
          <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-950">Schlüssel</p>
              <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700" onClick={addKeyRow} type="button">
                + Schlüssel
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {keyRows.map((row) => (
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_140px]" key={row.id}>
                  <input className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none" onChange={(event) => updateKeyRow(row.id, 'label', event.target.value)} placeholder="Schlüsselbezeichnung" value={row.label} />
                  <input className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none" onChange={(event) => updateKeyRow(row.id, 'count', event.target.value)} placeholder="Soll" value={row.count || ''} />
                  <input className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none" onChange={(event) => updateKeyRow(row.id, 'value', event.target.value)} placeholder="Übergabe" value={row.value} />
                </div>
              ))}
              {keyRows.length === 0 ? <p className="text-sm text-slate-600">Keine Schlüssel an der Einheit hinterlegt.</p> : null}
            </div>
          </div>
          <textarea
            className="min-h-24 rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            onChange={(event) => updateForm('notes', event.target.value)}
            placeholder="Notizen"
            value={form.notes}
          />
          <label className="block rounded-[22px] border border-dashed border-stone-300 bg-stone-50 px-4 py-4">
            <p className="text-sm font-semibold text-slate-950">Foto- und Videoaufnahmen</p>
            <input
              accept="image/*,video/*"
              className="mt-3 block w-full text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700"
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              type="file"
            />
            {files.length ? (
              <div className="mt-3 grid gap-1 text-sm text-slate-600">
                {files.map((file) => <span key={`${file.name}-${file.size}`}>{file.name}</span>)}
              </div>
            ) : null}
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            className="rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-5 py-2.5 text-sm font-medium text-stone-100 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending || !tenant}
            onClick={saveProtocol}
            type="button"
          >
            Protokoll speichern
          </button>
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        </div>
      </section>
    </div>
  );
}
