import { getAdminDb, hasFirebaseAdminConfig } from './firebaseAdmin';
import { ADMIN_SETTINGS_COLLECTION } from './mailboxSettings';
import {
  EMAIL_SIGNATURE_SETTINGS_DOC_ID,
  cleanEmailSignatureTemplate,
  type EmailSignatureSettings,
} from './signatureSettings';

export async function getEmailSignatureSettingsServer(): Promise<EmailSignatureSettings> {
  if (!hasFirebaseAdminConfig()) {
    return { templateHtml: cleanEmailSignatureTemplate('') };
  }

  try {
    const snapshot = await getAdminDb()
      .collection(ADMIN_SETTINGS_COLLECTION)
      .doc(EMAIL_SIGNATURE_SETTINGS_DOC_ID)
      .get();
    const data = snapshot.exists ? snapshot.data() : null;
    return {
      templateHtml: cleanEmailSignatureTemplate(data?.templateHtml),
    };
  } catch {
    return { templateHtml: cleanEmailSignatureTemplate('') };
  }
}
