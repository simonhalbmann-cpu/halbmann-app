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
            { href: '/mieterportal/nachrichten', label: 'Nachrichten' },
            { href: '/mieterportal/dokumente', label: 'Dokumente' },
            { href: '/mieterportal', label: 'Stammdaten' },
          ],
        },
      ]}
      requiredRole="portal"
      title="Portal"
    >
      {children}
    </ProtectedAreaLayout>
  );
}
