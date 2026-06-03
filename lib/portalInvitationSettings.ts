import { ADMIN_SETTINGS_COLLECTION } from './aiSettings';

export const PORTAL_INVITATION_SETTINGS_DOC_ID = 'portalInvitation';
export const PORTAL_INVITATION_SETTINGS_COLLECTION = ADMIN_SETTINGS_COLLECTION;

export type PortalInvitationSettings = {
  bodyTemplate?: string;
  subject?: string;
  updatedAt?: unknown;
};

export function defaultPortalInvitationSettings(): PortalInvitationSettings {
  return {
    subject: 'Ihr Zugang zum Halbmann Portal',
    bodyTemplate: [
      '{{GREETING}}',
      '',
      'für {{DISPLAY_NAME}} wurde ein persönlicher Zugang zum Halbmann Portal eingerichtet.',
      '',
      'Ihre Zugangsdaten:',
      'Benutzername: {{USERNAME}}',
      'Passwort: {{PASSWORD}}',
      '',
      'Anmeldung über unsere Homepage:',
      '{{LOGIN_URL}}',
      '',
      '{{PORTAL_EXPLANATION}}',
      '',
      'Vorteile auf einen Blick:',
      '- direkter Nachrichtenverlauf mit der Verwaltung',
      '- wichtige Unterlagen an einem Ort',
      '- schnelle Rückfragen ohne Umwege',
      '',
      '{{SIGNATURE}}',
    ].join('\n'),
  };
}
