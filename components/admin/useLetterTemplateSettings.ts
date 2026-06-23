'use client';

import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { LETTER_TEMPLATE_SETTINGS_DOC_ID, type LetterTemplateSettings } from '../../lib/letterTemplateSettings';
import { ADMIN_SETTINGS_COLLECTION } from '../../lib/mailboxSettings';

export function useLetterTemplateSettings() {
  const [settings, setSettings] = useState<LetterTemplateSettings>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, ADMIN_SETTINGS_COLLECTION, LETTER_TEMPLATE_SETTINGS_DOC_ID),
      (snapshot) => {
        setSettings((snapshot.data() ?? {}) as LetterTemplateSettings);
      },
      (error) => {
        console.error('Fehler beim Laden der globalen Word-Vorlagen:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  return settings;
}
