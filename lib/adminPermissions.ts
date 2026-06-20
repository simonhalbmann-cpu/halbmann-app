export type AdminPermissionKey =
  | 'settings.profile'
  | 'settings.employees'
  | 'settings.mailbox'
  | 'settings.ai'
  | 'settings.letters'
  | 'settings.signatures'
  | 'messages.read'
  | 'messages.reply'
  | 'messages.archive'
  | 'messages.delete'
  | 'tenants.read'
  | 'tenants.create'
  | 'tenants.update'
  | 'tenants.delete'
  | 'properties.read'
  | 'properties.create'
  | 'properties.update'
  | 'properties.delete'
  | 'properties.meters'
  | 'companies.read'
  | 'companies.create'
  | 'companies.update'
  | 'companies.delete'
  | 'contacts.read'
  | 'contacts.create'
  | 'contacts.update'
  | 'contacts.delete'
  | 'documents.email'
  | 'documents.letter'
  | 'documents.templates';

export type AdminLevel = 'super_admin' | 'manager' | 'assistant';

export type AdminPermissions = Partial<Record<AdminPermissionKey, boolean>>;

export type AdminPermissionDefinition = {
  description: string;
  key: AdminPermissionKey;
  label: string;
};

export type AdminPermissionGroup = {
  description: string;
  items: AdminPermissionDefinition[];
  title: string;
};

export const adminPermissionGroups: AdminPermissionGroup[] = [
  {
    title: 'Einstellungen',
    description: 'Steuert, welche Verwaltungsbereiche der Mitarbeiter in den Einstellungen bearbeiten darf.',
    items: [
      {
        key: 'settings.profile',
        label: 'Eigenes Profil bearbeiten',
        description: 'Name, Telefon, Mobilfunk und interne Kontakt-E-Mail des eigenen Zugangs pflegen.',
      },
      {
        key: 'settings.employees',
        label: 'Mitarbeiter verwalten',
        description: 'Verwalter anlegen, deaktivieren, loeschen und deren Rechte bearbeiten.',
      },
      {
        key: 'settings.mailbox',
        label: 'Postfach-Zugang',
        description: 'IMAP/SMTP-Zugangsdaten fuer den Nachrichteneingang und Versand aendern.',
      },
      {
        key: 'settings.ai',
        label: 'KI-Einstellungen',
        description: 'Vorlagen und Regeln fuer automatische Antwortvorschlaege bearbeiten.',
      },
      {
        key: 'settings.letters',
        label: 'Vorlagen',
        description: 'Brieftexte, Briefkopf, Uebergabeprotokolle und Standardbausteine verwalten.',
      },
      {
        key: 'settings.signatures',
        label: 'Signaturen',
        description: 'E-Mail- und Briefsignaturen der Firmen bearbeiten.',
      },
    ],
  },
  {
    title: 'Nachrichten',
    description: 'Regelt den Zugriff auf Posteingang, Antworten und Nachrichtenverwaltung.',
    items: [
      {
        key: 'messages.read',
        label: 'Nachrichten lesen',
        description: 'Posteingang, Konversationen und Detailansichten oeffnen.',
      },
      {
        key: 'messages.reply',
        label: 'Nachrichten beantworten',
        description: 'Antworten schreiben, senden und KI-Entwuerfe verwenden.',
      },
      {
        key: 'messages.archive',
        label: 'Nachrichten archivieren',
        description: 'Vorgaenge abschliessen, archivieren oder wieder oeffnen.',
      },
      {
        key: 'messages.delete',
        label: 'Nachrichten loeschen',
        description: 'Nachrichten und Entwuerfe endgueltig entfernen.',
      },
    ],
  },
  {
    title: 'Mieter',
    description: 'Berechtigungen fuer Mieterdaten, Kontakte und interne Mieterverwaltung.',
    items: [
      {
        key: 'tenants.read',
        label: 'Mieter ansehen',
        description: 'Mieterlisten, Stammdaten, Dokumente und Kommunikationsverlauf sehen.',
      },
      {
        key: 'tenants.create',
        label: 'Mieter anlegen',
        description: 'Neue Mieter oder Mietverhaeltnisse erfassen.',
      },
      {
        key: 'tenants.update',
        label: 'Mieter bearbeiten',
        description: 'Stammdaten, Zuordnungen, Kontaktdaten und Notizen aendern.',
      },
      {
        key: 'tenants.delete',
        label: 'Mieter loeschen',
        description: 'Mieterprofile und zugehoerige Zuordnungen entfernen.',
      },
    ],
  },
  {
    title: 'Immobilien',
    description: 'Steuert Zugriff auf Objekte, Einheiten und technische Daten.',
    items: [
      {
        key: 'properties.read',
        label: 'Immobilien ansehen',
        description: 'Objektlisten, Einheiten, Flaechen und Objektstammdaten sehen.',
      },
      {
        key: 'properties.create',
        label: 'Immobilien anlegen',
        description: 'Neue Objekte, Einheiten oder Standorte erstellen.',
      },
      {
        key: 'properties.update',
        label: 'Immobilien bearbeiten',
        description: 'Objektstammdaten, Einheiten und Zuordnungen aendern.',
      },
      {
        key: 'properties.delete',
        label: 'Immobilien loeschen',
        description: 'Objekte oder Einheiten dauerhaft entfernen.',
      },
      {
        key: 'properties.meters',
        label: 'Zaehlerstaende verwalten',
        description: 'Zaehler, Ablesungen und Schadensmeldungen bearbeiten.',
      },
    ],
  },
  {
    title: 'Firmen',
    description: 'Rechte fuer Vermieterfirmen, Gesellschaftsdaten und Absenderdaten.',
    items: [
      {
        key: 'companies.read',
        label: 'Firmen ansehen',
        description: 'Firmendaten, Anschriften und Ansprechpartner sehen.',
      },
      {
        key: 'companies.create',
        label: 'Firmen anlegen',
        description: 'Neue Vermieterfirmen oder Gesellschaften erstellen.',
      },
      {
        key: 'companies.update',
        label: 'Firmen bearbeiten',
        description: 'Firmendaten, Registerdaten und Kontaktinformationen aendern.',
      },
      {
        key: 'companies.delete',
        label: 'Firmen loeschen',
        description: 'Firmenprofile aus dem Bestand entfernen.',
      },
    ],
  },
  {
    title: 'Dritte & Dienstleister',
    description: 'Zugriff auf externe Kontakte, Dienstleister und Partner.',
    items: [
      {
        key: 'contacts.read',
        label: 'Kontakte ansehen',
        description: 'Dienstleister, Dritte und externe Ansprechpartner sehen.',
      },
      {
        key: 'contacts.create',
        label: 'Kontakte anlegen',
        description: 'Neue Dienstleister oder Ansprechpartner erfassen.',
      },
      {
        key: 'contacts.update',
        label: 'Kontakte bearbeiten',
        description: 'Kontakt-, Rollen- und Notizdaten aendern.',
      },
      {
        key: 'contacts.delete',
        label: 'Kontakte loeschen',
        description: 'Externe Kontakte dauerhaft entfernen.',
      },
    ],
  },
  {
    title: 'Mails & Briefe',
    description: 'Legt fest, wer Dokumente erstellen und versenden darf.',
    items: [
      {
        key: 'documents.email',
        label: 'E-Mails erstellen',
        description: 'E-Mails aus Vorlagen erstellen, bearbeiten und versenden.',
      },
      {
        key: 'documents.letter',
        label: 'Briefe erstellen',
        description: 'Briefe erzeugen, drucken und als Dokument ablegen.',
      },
      {
        key: 'documents.templates',
        label: 'Vorlagen verwenden',
        description: 'Vorlagen und Textbausteine in Nachrichten und Briefen einsetzen.',
      },
    ],
  },
];

export const allAdminPermissionKeys = adminPermissionGroups.flatMap((group) =>
  group.items.map((item) => item.key)
);

export function createAdminPermissions(enabled = false): Record<AdminPermissionKey, boolean> {
  return allAdminPermissionKeys.reduce(
    (permissions, key) => ({ ...permissions, [key]: enabled }),
    {} as Record<AdminPermissionKey, boolean>
  );
}

export function normalizeAdminPermissions(
  value: unknown,
  enabledByDefault = false
): Record<AdminPermissionKey, boolean> {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return allAdminPermissionKeys.reduce(
    (permissions, key) => ({
      ...permissions,
      [key]: typeof source[key] === 'boolean' ? source[key] : enabledByDefault,
    }),
    {} as Record<AdminPermissionKey, boolean>
  );
}

export function getDefaultAdminLevel(value: unknown, fallback: AdminLevel = 'manager'): AdminLevel {
  return value === 'super_admin' || value === 'manager' || value === 'assistant'
    ? value
    : fallback;
}

export function hasAdminPermission(
  profile: { adminLevel?: AdminLevel | null; adminPermissions?: AdminPermissions | null } | null | undefined,
  key: AdminPermissionKey
) {
  if (profile?.adminLevel === 'super_admin') return true;
  return profile?.adminPermissions?.[key] === true;
}
