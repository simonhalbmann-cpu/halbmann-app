import type { ReactNode } from 'react';
import ProtectedAreaLayout from '../../components/ProtectedAreaLayout';

export default function MieterportalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ProtectedAreaLayout
      navSections={[
        {
          links: [
            { href: '/mieterportal', label: 'Uebersicht' },
            { href: '/mieterportal/dokumente', label: 'Dokumente' },
            { href: '/mieterportal/nachrichten', label: 'Nachrichten' },
          ],
        },
      ]}
      requiredRole="tenant"
      title="Mieterportal"
    >
      {children}
    </ProtectedAreaLayout>
  );
}
