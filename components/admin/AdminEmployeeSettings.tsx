'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  adminPermissionGroups,
  createAdminPermissions,
  getDefaultAdminLevel,
  normalizeAdminPermissions,
  type AdminLevel,
  type AdminPermissionKey,
  type AdminPermissions,
} from '../../lib/adminPermissions';

type EmployeeRecord = {
  active: boolean;
  adminLevel?: AdminLevel;
  adminPermissions?: AdminPermissions;
  authEmail: string;
  contactEmail: string;
  displayName: string;
  email: string;
  mobilePhone: string;
  phone: string;
  uid: string;
};

type EmployeeForm = {
  active: boolean;
  adminLevel: AdminLevel;
  adminPermissions: Record<AdminPermissionKey, boolean>;
  contactEmail: string;
  displayName: string;
  email: string;
  mobilePhone: string;
  password: string;
  phone: string;
  uid: string;
};

const emptyForm: EmployeeForm = {
  active: true,
  adminLevel: 'manager',
  adminPermissions: createAdminPermissions(false),
  contactEmail: '',
  displayName: '',
  email: '',
  mobilePhone: '',
  password: '',
  phone: '',
  uid: '',
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function formFromEmployee(employee: EmployeeRecord): EmployeeForm {
  return {
    active: employee.active,
    adminLevel: getDefaultAdminLevel(employee.adminLevel),
    adminPermissions: normalizeAdminPermissions(
      employee.adminPermissions,
      employee.adminLevel === 'super_admin'
    ),
    contactEmail: employee.contactEmail,
    displayName: employee.displayName,
    email: employee.email || employee.authEmail,
    mobilePhone: employee.mobilePhone,
    password: '',
    phone: employee.phone,
    uid: employee.uid,
  };
}

function Field({
  action,
  label,
  onChange,
  placeholder,
  type = 'text',
  value,
}: {
  action?: ReactNode;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className="relative mt-2 block">
        <input
          className={`w-full rounded-[18px] border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60 ${
            action ? 'pr-12' : ''
          }`}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={type}
          value={value}
        />
        {action}
      </span>
    </label>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M2.75 12s3.5-6.25 9.25-6.25S21.25 12 21.25 12 17.5 18.25 12 18.25 2.75 12 2.75 12Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M12 14.75A2.75 2.75 0 1 0 12 9.5a2.75 2.75 0 0 0 0 5.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      {hidden ? (
        <path
          d="M4.5 4.5l15 15"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      ) : null}
    </svg>
  );
}

export default function AdminEmployeeSettings({
  selectedUidFromRoute = '',
}: {
  selectedUidFromRoute?: string;
}) {
  const { refreshProfile, user } = useAuth();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [selectedUid, setSelectedUid] = useState('');
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.uid === selectedUid) ?? null,
    [employees, selectedUid]
  );

  async function getToken() {
    const token = await user?.getIdToken();
    if (!token) throw new Error('missing_auth_token');
    return token;
  }

  async function loadEmployees() {
    setIsLoading(true);
    setError('');
    try {
      const token = await getToken();
      const response = await fetch('/api/admin/employees', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = (await response.json()) as {
        employees?: EmployeeRecord[];
        error?: string;
        ok?: boolean;
      };
      if (!response.ok || !result.ok) throw new Error(result.error || 'employees_load_failed');

      const nextEmployees = Array.isArray(result.employees) ? result.employees : [];
      setEmployees(nextEmployees);
      setSelectedUid((current) => {
        if (selectedUidFromRoute && nextEmployees.some((employee) => employee.uid === selectedUidFromRoute)) {
          return selectedUidFromRoute;
        }
        return current && nextEmployees.some((employee) => employee.uid === current) ? current : '';
      });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : '';
      setError(
        message === 'firebase_admin_not_configured'
          ? 'Firebase Admin ist nicht konfiguriert. Lokal wird nur die einfache Mitarbeiteranlage unterstützt.'
          : 'Die Mitarbeiter konnten nicht geladen werden.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!user) {
      setEmployees([]);
      setIsLoading(false);
      return;
    }
    void loadEmployees();
  }, [selectedUidFromRoute, user]);

  useEffect(() => {
    if (!selectedUidFromRoute) return;
    setSelectedUid(selectedUidFromRoute);
  }, [selectedUidFromRoute]);

  useEffect(() => {
    setForm(selectedEmployee ? formFromEmployee(selectedEmployee) : emptyForm);
  }, [selectedEmployee]);

  function updateField<K extends keyof EmployeeForm>(field: K, value: EmployeeForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateAdminLevel(adminLevel: AdminLevel) {
    setForm((current) => ({
      ...current,
      adminLevel,
      adminPermissions:
        adminLevel === 'super_admin'
          ? createAdminPermissions(true)
          : normalizeAdminPermissions(current.adminPermissions, false),
    }));
  }

  function updatePermission(key: AdminPermissionKey, checked: boolean) {
    setForm((current) => ({
      ...current,
      adminPermissions: { ...current.adminPermissions, [key]: checked },
    }));
  }

  function createNewEmployee() {
    setSelectedUid('');
    setForm(emptyForm);
    setMessage('');
    setError('');
  }

  function saveEmployee() {
    setMessage('');
    setError('');

    startTransition(async () => {
      try {
        const token = await getToken();
        const response = await fetch('/api/admin/employees', {
          body: JSON.stringify({
            active: form.active,
            adminLevel: form.adminLevel,
            adminPermissions:
              form.adminLevel === 'super_admin'
                ? createAdminPermissions(true)
                : form.adminPermissions,
            contactEmail: cleanText(form.contactEmail),
            displayName: cleanText(form.displayName),
            email: cleanText(form.email),
            mobilePhone: cleanText(form.mobilePhone),
            password: cleanText(form.password),
            phone: cleanText(form.phone),
            uid: cleanText(form.uid),
          }),
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
        });
        const result = (await response.json()) as {
          employee?: EmployeeRecord;
          error?: string;
          ok?: boolean;
        };
        if (!response.ok || !result.ok || !result.employee) {
          throw new Error(result.error || 'employee_save_failed');
        }

        setEmployees((current) => {
          const withoutSaved = current.filter((employee) => employee.uid !== result.employee!.uid);
          return [...withoutSaved, result.employee!].sort((left, right) =>
            (left.displayName || left.email).localeCompare(right.displayName || right.email, 'de')
          );
        });
        setSelectedUid(result.employee.uid);
        setForm(formFromEmployee(result.employee));
        if (result.employee.uid === user?.uid) {
          await refreshProfile();
        }
        setMessage('Mitarbeiter wurde gespeichert.');
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : '';
        setError(
          message === 'password_required'
            ? 'Beim Anlegen muss ein Passwort mit mindestens 8 Zeichen gesetzt werden.'
            : message === 'local_password_change_not_supported'
            ? 'Lokal kann das Passwort bestehender Mitarbeiter nicht geändert werden. Das geht später mit Firebase Admin auf dem Server.'
            : message.includes('EMAIL_EXISTS')
            ? 'Diese Login-E-Mail existiert bereits. Wenn das Passwort stimmt, wird der vorhandene Zugang jetzt automatisch übernommen. Bitte erneut speichern.'
            : message.includes('INVALID_LOGIN_CREDENTIALS') || message.includes('INVALID_PASSWORD')
            ? 'Diese Login-E-Mail existiert bereits, aber das eingegebene Passwort passt nicht.'
            : `Der Mitarbeiter konnte nicht gespeichert werden. (${message || 'unbekannter Fehler'})`
        );
      }
    });
  }

  function deleteEmployee() {
    if (!form.uid && !form.email) return;
    const confirmed = window.confirm(
      form.uid
        ? 'Mitarbeiter wirklich löschen? Der Login-Zugang wird entfernt.'
        : 'Vorhandenen Firebase-Zugang mit dieser E-Mail löschen? Dafür muss das Passwort stimmen.'
    );
    if (!confirmed) return;

    setMessage('');
    setError('');

    startTransition(async () => {
      try {
        const token = await getToken();
        const response = await fetch('/api/admin/employees', {
          body: JSON.stringify({
            email: cleanText(form.email),
            password: cleanText(form.password),
            uid: cleanText(form.uid),
          }),
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          method: 'DELETE',
        });
        const result = (await response.json()) as { error?: string; ok?: boolean };
        if (!response.ok || !result.ok) throw new Error(result.error || 'employee_delete_failed');

        setEmployees((current) => current.filter((employee) => employee.uid !== form.uid));
        setSelectedUid('');
        setForm(emptyForm);
        setMessage('Mitarbeiter wurde gelöscht.');
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : '';
        setError(
          message === 'cannot_delete_self'
            ? 'Der aktuell angemeldete Benutzer kann sich nicht selbst löschen.'
            : message === 'password_required_for_local_delete'
            ? 'Lokal muss zum Löschen das Passwort des Mitarbeiters eingetragen sein.'
            : message.includes('INVALID_LOGIN_CREDENTIALS') || message.includes('INVALID_PASSWORD')
            ? 'Das Passwort passt nicht zu dieser Login-E-Mail.'
            : 'Der Mitarbeiter konnte nicht gelöscht werden.'
        );
      }
    });
  }

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
            Mitarbeiter
          </p>
          <h2 className="mt-2 text-3xl text-slate-950">Verwalterzugänge</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            Hier werden Verwalter angelegt und deren Absenderdaten für E-Mails und Briefe gepflegt.
          </p>
        </div>
        <button
          className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400"
          onClick={createNewEmployee}
          type="button"
        >
          Neuer Mitarbeiter
        </button>
      </div>

      {selectedUidFromRoute ? (
        <Link
          className="mt-5 inline-flex rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-stone-400"
          href="/admin/einstellungen?tab=mitarbeiter"
        >
          Zur Mitarbeiterliste
        </Link>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">Verwalter</p>
          <div className="mt-4 space-y-2">
            {isLoading ? (
              <div className="rounded-[18px] border border-stone-200 bg-white px-4 py-3 text-sm text-slate-600">
                Wird geladen...
              </div>
            ) : employees.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-stone-300 bg-white px-4 py-5 text-sm text-slate-600">
                Noch keine Mitarbeiter gefunden.
              </div>
            ) : (
              employees.map((employee) => (
                <Link
                  className={`block w-full rounded-[18px] border px-4 py-3 text-left text-sm transition ${
                    selectedUid === employee.uid
                      ? 'border-amber-300 bg-amber-50 text-slate-950'
                      : 'border-stone-200 bg-white text-slate-700 hover:border-stone-300'
                  }`}
                  href={`/admin/einstellungen/mitarbeiter/${employee.uid}`}
                  key={employee.uid}
                >
                  <span className="block truncate font-medium">
                    {employee.displayName || employee.email || employee.uid}
                  </span>
                  <span className="mt-1 block truncate text-xs text-slate-500">
                    {employee.active ? 'Aktiv' : 'Inaktiv'} · {employee.email}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
                  {form.uid ? 'Bearbeiten' : 'Anlegen'}
                </p>
                <h3 className="mt-2 text-2xl text-slate-950">
                  {form.uid ? form.displayName || form.email : 'Neuer Mitarbeiter'}
                </h3>
              </div>
              <label className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-slate-700">
                <input
                  checked={form.active}
                  onChange={(event) => updateField('active', event.target.checked)}
                  type="checkbox"
                />
                Aktiv
              </label>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Rolle</span>
                <select
                  className="mt-2 w-full rounded-[18px] border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700/60"
                  onChange={(event) => updateAdminLevel(event.target.value as AdminLevel)}
                  value={form.adminLevel}
                >
                  <option value="super_admin">Super Admin - alle Rechte</option>
                  <option value="manager">Verwalter - Rechte einzeln steuern</option>
                  <option value="assistant">Assistenz - Rechte einzeln steuern</option>
                </select>
              </label>
              <Field label="Name" onChange={(value) => updateField('displayName', value)} value={form.displayName} />
              <Field
                label="Login-E-Mail"
                onChange={(value) => updateField('email', value)}
                type="email"
                value={form.email}
              />
              <Field
                label="Kontakt-E-Mail intern"
                onChange={(value) => updateField('contactEmail', value)}
                placeholder={form.email}
                type="email"
                value={form.contactEmail}
              />
              <Field
                label={form.uid ? 'Neues Passwort optional' : 'Start-Passwort'}
                onChange={(value) => updateField('password', value)}
                placeholder={form.uid ? 'leer lassen, wenn unverändert' : 'mindestens 8 Zeichen'}
                action={
                  <button
                    aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-sm text-slate-500 transition hover:bg-stone-200 hover:text-slate-800"
                    onClick={(event) => {
                      event.preventDefault();
                      setShowPassword((current) => !current);
                    }}
                    type="button"
                  >
                    <EyeIcon hidden={showPassword} />
                  </button>
                }
                type={showPassword ? 'text' : 'password'}
                value={form.password}
              />
              <Field label="Telefon" onChange={(value) => updateField('phone', value)} type="tel" value={form.phone} />
              <Field
                label="Mobilfunk"
                onChange={(value) => updateField('mobilePhone', value)}
                type="tel"
                value={form.mobilePhone}
              />
            </div>

            <div className="mt-8 border-t border-stone-200 pt-6">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
                  Rechte
                </p>
                <h4 className="mt-2 text-xl text-slate-950">Zugriff im Programm</h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Aktiviere nur die Bereiche, die dieser Mitarbeiter sehen oder bearbeiten darf.
                  Super Admins haben automatisch alle Rechte.
                </p>
              </div>

              <div className="mt-5 space-y-4">
                {adminPermissionGroups.map((group) => (
                  <div className="rounded-[22px] border border-stone-200 bg-white p-4" key={group.title}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h5 className="text-base font-semibold text-slate-950">{group.title}</h5>
                        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                          {group.description}
                        </p>
                      </div>
                      <button
                        className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-stone-400 disabled:opacity-50"
                        disabled={form.adminLevel === 'super_admin'}
                        onClick={() =>
                          setForm((current) => {
                            const everyEnabled = group.items.every(
                              (item) => current.adminPermissions[item.key]
                            );
                            const nextPermissions = { ...current.adminPermissions };
                            group.items.forEach((item) => {
                              nextPermissions[item.key] = !everyEnabled;
                            });
                            return { ...current, adminPermissions: nextPermissions };
                          })
                        }
                        type="button"
                      >
                        Alle {group.items.every((item) => form.adminPermissions[item.key]) ? 'aus' : 'an'}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {group.items.map((item) => (
                        <label
                          className={`flex min-h-[92px] cursor-pointer items-start gap-3 rounded-[18px] border p-4 transition ${
                            form.adminPermissions[item.key]
                              ? 'border-amber-300 bg-amber-50'
                              : 'border-stone-200 bg-stone-50 hover:border-stone-300'
                          } ${form.adminLevel === 'super_admin' ? 'cursor-default opacity-80' : ''}`}
                          key={item.key}
                        >
                          <input
                            checked={form.adminLevel === 'super_admin' || form.adminPermissions[item.key]}
                            className="mt-1 h-4 w-4 accent-amber-800"
                            disabled={form.adminLevel === 'super_admin'}
                            onChange={(event) => updatePermission(item.key, event.target.checked)}
                            type="checkbox"
                          />
                          <span>
                            <span className="block text-sm font-semibold text-slate-950">{item.label}</span>
                            <span className="mt-1 block text-sm leading-6 text-slate-600">
                              {item.description}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-5 py-3 text-sm font-medium text-stone-100 transition hover:brightness-105 disabled:opacity-50"
                disabled={isPending || !user}
                onClick={saveEmployee}
                type="button"
              >
                {isPending ? 'Wird gespeichert...' : 'Mitarbeiter speichern'}
              </button>
              <button
                className="rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-medium text-rose-700 transition hover:border-rose-300 disabled:opacity-50"
                disabled={isPending || (!form.uid && !form.email)}
                onClick={deleteEmployee}
                type="button"
              >
                Mitarbeiter löschen
              </button>
            </div>
          </div>

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
