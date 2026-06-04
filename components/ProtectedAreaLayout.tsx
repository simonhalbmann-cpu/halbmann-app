'use client';

import {
  collection,
  onSnapshot,
  query,
  type DocumentData,
} from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../lib/firebase';
import { persistInboundEmailsClient, type SyncedInboundEmail } from '../lib/clientWorkflow';
import {
  getDefaultRouteForRole,
  getLoginRouteForRole,
  getRoleLabel,
  type UserRole,
} from '../lib/auth';
import { db } from '../lib/firebase';
import { buildPortalDisplayName } from '../lib/portalAccess';
import { hasAdminPermission, type AdminPermissionKey } from '../lib/adminPermissions';

type NavLink = {
  href: string;
  label: string;
  permissionKey?: AdminPermissionKey;
};

type NavSection = {
  label?: string;
  links: NavLink[];
};

type ProtectedAreaLayoutProps = {
  children: ReactNode;
  navSections: NavSection[];
  requiredRole: UserRole;
  title: string;
};

type AdminRecord = {
  data: DocumentData;
  id: string;
};

type SearchResult = {
  companyId?: string;
  label: string;
  propertyId?: string;
  tenantId?: string;
  type: 'company' | 'property' | 'tenant' | 'unit';
  unitId?: string;
};

const settingsLinks: Array<{
  href: string;
  label: string;
  permissionKey: AdminPermissionKey;
}> = [
  { href: '/admin/einstellungen', label: 'E-Mail-Postfach', permissionKey: 'settings.mailbox' },
  { href: '/admin/einstellungen?tab=profil', label: 'Mein Profil', permissionKey: 'settings.profile' },
  { href: '/admin/einstellungen?tab=mitarbeiter', label: 'Mitarbeiter', permissionKey: 'settings.employees' },
  { href: '/admin/einstellungen?tab=ki', label: 'KI-Prompt', permissionKey: 'settings.ai' },
  { href: '/admin/einstellungen?tab=brief', label: 'Vorlagen', permissionKey: 'settings.letters' },
  { href: '/admin/einstellungen?tab=signaturen', label: 'Signaturen', permissionKey: 'settings.signatures' },
];

const cleanText = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

function resolveActiveNavHref(pathname: string, hrefs: string[]) {
  const matches = hrefs.filter((href) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  });

  return matches.sort((left, right) => right.length - left.length)[0] ?? '';
}

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const unitDisplayLabel = (unit: DocumentData) =>
  Array.from(
    new Set(
      [
        cleanText(unit.unitLabel),
        cleanText(unit.floor),
        cleanText(unit.unitPosition),
        cleanText(unit.section),
      ].filter(Boolean)
    )
  ).join(' · ');

const unitMenuLabel = (floorValue?: unknown, positionValue?: unknown) => {
  const floor = cleanText(floorValue);
  const position = cleanText(positionValue);
  const mappedPosition =
    position === 'li' ? 'Li' : position === 're' ? 'Re' : position === 'mi' ? 'Mi' : '';

  return [floor, mappedPosition].filter(Boolean).join(' . ') || 'Einheit';
};

function getHeaderContent(pathname: string, fallbackTitle: string) {
  if (
    pathname === '/admin/nachrichten' ||
    pathname.startsWith('/admin/nachrichten/')
  ) {
    return {
      description: '',
      title: '',
    };
  }

  const adminHeaders: Array<{
    description: string;
    path: string;
    title: string;
  }> = [
    {
      path: '/admin/nachrichten',
      title: 'Eingang für Portal, E-Mail und Folgeaktionen',
      description:
        'Hier laufen Nachrichten aus dem Portal und von portal@halbmann-holding.de zusammen. Sie werden zugeordnet, bewertet und direkt in bearbeitbare Vorgänge überführt.',
    },
    {
      path: '/admin',
      title: 'Überblick für Kommunikation, Themen und Bestand',
      description:
        'Das Dashboard bündelt Kommunikation, offene Vorgänge, Bestand und die nächsten operativen Schritte in einer kompakten Übersicht.',
    },
    {
      path: '/admin/einstellungen',
      title: 'Globale Einstellungen',
      description:
        'Hier pflegst du zentrale Konfigurationen wie Postfach, IMAP, SMTP und weitere globale Systemzugänge.',
    },
  ];

  const matched = adminHeaders.find((entry) => pathname === entry.path);
  if (matched) return matched;

  return {
    description: '',
    title: fallbackTitle,
  };
}

function resolveRequiredAdminPermission(
  pathname: string,
  settingsTab: string
): AdminPermissionKey | null {
  if (pathname === '/admin') return null;

  if (pathname === '/admin/einstellungen') {
    if (settingsTab === 'profil') return 'settings.profile';
    if (settingsTab === 'mitarbeiter') return 'settings.employees';
    if (settingsTab === 'ki') return 'settings.ai';
    if (settingsTab === 'brief') return 'settings.letters';
    if (settingsTab === 'signaturen') return 'settings.signatures';
    return 'settings.mailbox';
  }
  if (pathname.startsWith('/admin/einstellungen/mitarbeiter/')) {
    return 'settings.employees';
  }

  if (pathname === '/admin/nachrichten' || pathname.startsWith('/admin/nachrichten/')) {
    return 'messages.read';
  }

  if (pathname === '/admin/firma' || pathname === '/admin/firmen') return 'companies.create';
  if (/^\/admin\/firma\/[^/]+\/bearbeiten$/.test(pathname)) return 'companies.update';
  if (/^\/admin\/firma\/[^/]+$/.test(pathname)) return 'companies.read';

  if (pathname === '/admin/immobilie' || pathname === '/admin/objekte') return 'properties.create';
  if (/^\/admin\/immobilie\/[^/]+\/bearbeiten$/.test(pathname)) return 'properties.update';
  if (/^\/admin\/immobilie\/[^/]+$/.test(pathname)) return 'properties.read';
  if (/^\/admin\/einheit\/[^/]+\/[^/]+$/.test(pathname)) return 'properties.read';
  if (/^\/admin\/zaehler\/[^/]+\/[^/]+$/.test(pathname)) return 'properties.meters';

  if (pathname === '/admin/mieter') return 'tenants.create';
  if (/^\/admin\/mieter\/[^/]+\/bearbeiten$/.test(pathname)) return 'tenants.update';
  if (/^\/admin\/mieter\/[^/]+$/.test(pathname)) return 'tenants.read';

  if (pathname === '/admin/personen' || pathname === '/admin/kontakte') return 'contacts.create';
  if (/^\/admin\/personen\/[^/]+\/bearbeiten$/.test(pathname)) return 'contacts.update';
  if (/^\/admin\/personen\/[^/]+$/.test(pathname)) return 'contacts.read';

  return null;
}

function resolveSettingsSidebarTitle(settingsTab: string) {
  if (settingsTab === 'profil') return 'Mein Profil';
  if (settingsTab === 'mitarbeiter') return 'Mitarbeiter';
  if (settingsTab === 'ki') return 'KI';
  if (settingsTab === 'brief') return 'Vorlagen';
  if (settingsTab === 'signaturen') return 'Signaturen';
  return 'Postfach-Zugang';
}

function resolveAdminSidebarTitle(
  pathname: string,
  settingsTab: string,
  mailboxViewLabel: 'Archiv' | 'Posteingang',
  tenantMailboxMode: boolean
) {
  if (pathname === '/admin') return 'Dashboard';
  if (pathname === '/admin/einstellungen') return resolveSettingsSidebarTitle(settingsTab);
  if (pathname.startsWith('/admin/einstellungen/mitarbeiter/')) return 'Mitarbeiter';
  if (pathname === '/admin/nachrichten' || pathname.startsWith('/admin/nachrichten/') || tenantMailboxMode) {
    return mailboxViewLabel;
  }
  if (pathname === '/admin/firma' || pathname === '/admin/firmen' || pathname.startsWith('/admin/firma/')) {
    return 'Firma';
  }
  if (
    pathname === '/admin/immobilie' ||
    pathname === '/admin/objekte' ||
    pathname.startsWith('/admin/immobilie/') ||
    pathname.startsWith('/admin/einheit/') ||
    pathname.startsWith('/admin/zaehler/')
  ) {
    return 'Immobilie';
  }
  if (pathname === '/admin/mieter' || pathname.startsWith('/admin/mieter/')) return 'Mieter';
  if (
    pathname === '/admin/personen' ||
    pathname === '/admin/kontakte' ||
    pathname.startsWith('/admin/personen/')
  ) {
    return 'Dienstleister';
  }
  return 'Verwaltungsbereich';
}

export default function ProtectedAreaLayout({
  children,
  navSections,
  requiredRole,
  title,
}: ProtectedAreaLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mailboxViewLabel, setMailboxViewLabel] = useState<'Archiv' | 'Posteingang'>('Posteingang');
  const [tenantMailboxMode, setTenantMailboxMode] = useState(false);
  const { loading, profile, role, user } = useAuth();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [companies, setCompanies] = useState<AdminRecord[]>([]);
  const [properties, setProperties] = useState<AdminRecord[]>([]);
  const [tenants, setTenants] = useState<AdminRecord[]>([]);
  const [search, setSearch] = useState('');
  const [settingsTab, setSettingsTab] = useState('');
  const [openCompanies, setOpenCompanies] = useState<Record<string, boolean>>({});
  const [openProperties, setOpenProperties] = useState<Record<string, boolean>>({});
  const [openUnits, setOpenUnits] = useState<Record<string, boolean>>({});
  const [mailSyncNote, setMailSyncNote] = useState('');
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [portalSidebarName, setPortalSidebarName] = useState('');
  const settingsMenuCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleNavSections = useMemo(
    () =>
      navSections
        .map((section) => ({
          ...section,
          links:
            requiredRole === 'admin'
              ? section.links.filter(
                  (link) => !link.permissionKey || hasAdminPermission(profile, link.permissionKey)
                )
              : section.links,
        }))
        .filter((section) => section.links.length > 0),
    [navSections, profile, requiredRole]
  );
  const visibleSettingsLinks = useMemo(
    () =>
      requiredRole === 'admin'
        ? settingsLinks.filter((link) => hasAdminPermission(profile, link.permissionKey))
        : [],
    [profile, requiredRole]
  );
  const navHrefs = useMemo(
    () => visibleNavSections.flatMap((section) => section.links.map((link) => link.href)),
    [visibleNavSections]
  );
  const activeNavHref = useMemo(() => resolveActiveNavHref(pathname, navHrefs), [navHrefs, pathname]);
  const headerContent = useMemo(() => getHeaderContent(pathname, title), [pathname, title]);
  const isMessageRoute = pathname === '/admin/nachrichten' || pathname.startsWith('/admin/nachrichten/');
  const isTenantOverviewRoute = pathname === '/admin/mieter';
  const isTenantDetailRoute = /^\/admin\/mieter\/[^/]+$/.test(pathname);
  const isBriefSettingsRoute = pathname === '/admin/einstellungen' && settingsTab === 'brief';
  const requiredAdminPermission = useMemo(
    () =>
      requiredRole === 'admin'
        ? resolveRequiredAdminPermission(pathname, settingsTab)
        : null,
    [pathname, requiredRole, settingsTab]
  );
  const canViewCurrentAdminPage =
    requiredRole !== 'admin' ||
    !requiredAdminPermission ||
    hasAdminPermission(profile, requiredAdminPermission);
  const canReadCompanies = requiredRole !== 'admin' || hasAdminPermission(profile, 'companies.read');
  const canReadProperties = requiredRole !== 'admin' || hasAdminPermission(profile, 'properties.read');
  const canReadTenants = requiredRole !== 'admin' || hasAdminPermission(profile, 'tenants.read');
  const canViewInventoryTree =
    requiredRole === 'admin' && (canReadCompanies || canReadProperties || canReadTenants);
  const isCompactHeaderRoute = isMessageRoute || isTenantOverviewRoute || isTenantDetailRoute || isBriefSettingsRoute;
  const propertyDetailId = useMemo(() => {
    const match = pathname.match(/^\/admin\/immobilie\/([^/]+)$/);
    return match ? match[1] : '';
  }, [pathname]);
  const unitRouteMatch = useMemo(() => {
    const match = pathname.match(/^\/admin\/einheit\/([^/]+)\/([^/]+)$/);
    return match ? { propertyId: match[1], unitId: match[2] } : null;
  }, [pathname]);
  const currentPropertyName = useMemo(() => {
    if (!propertyDetailId) return '';
    const currentProperty = properties.find((record) => record.id === propertyDetailId) ?? null;
    return cleanText(currentProperty?.data.name);
  }, [properties, propertyDetailId]);
  const currentUnitLabel = useMemo(() => {
    if (!unitRouteMatch) return '';
    const currentProperty = properties.find((record) => record.id === unitRouteMatch.propertyId) ?? null;
    const currentUnit = Array.isArray(currentProperty?.data.units)
      ? currentProperty.data.units.find(
          (entry: DocumentData) =>
            entry && typeof entry === 'object' && cleanText(entry.id) === unitRouteMatch.unitId
        )
      : null;
    return currentUnit ? unitDisplayLabel(currentUnit) : '';
  }, [properties, unitRouteMatch]);
  const sidebarTitle = unitRouteMatch
    ? resolveAdminSidebarTitle(pathname, settingsTab, mailboxViewLabel, tenantMailboxMode)
    : propertyDetailId
      ? resolveAdminSidebarTitle(pathname, settingsTab, mailboxViewLabel, tenantMailboxMode)
    : requiredRole === 'portal'
      ? cleanText(portalSidebarName) ||
        cleanText(profile?.displayName) ||
        cleanText(profile?.username) ||
        title
    : resolveAdminSidebarTitle(pathname, settingsTab, mailboxViewLabel, tenantMailboxMode);
  const resolvedHeaderContent = isTenantOverviewRoute
    ? {
        description: '',
        title: '',
      }
    : propertyDetailId
    ? {
        description: '',
        title: currentPropertyName || 'Objekt',
      }
    : unitRouteMatch
      ? {
          description: '',
          title: currentUnitLabel || 'Einheit',
        }
    : headerContent;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isTenantMailboxPath = /^\/admin\/mieter\/[^/]+$/.test(pathname);
    const isMailboxPath = pathname === '/admin/nachrichten' || pathname.startsWith('/admin/nachrichten/') || isTenantMailboxPath;

    if (!isMailboxPath) {
      setMailboxViewLabel('Posteingang');
      setTenantMailboxMode(false);
      return;
    }

    const applyLabelFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const nextLabel = params.get('tab') === 'archive' ? 'Archiv' : 'Posteingang';
      setMailboxViewLabel(nextLabel);
      setTenantMailboxMode(isTenantMailboxPath);
    };
    const handleMailboxViewEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ tenantMailbox?: boolean; view?: string }>;
      setMailboxViewLabel(customEvent.detail?.view === 'archive' ? 'Archiv' : 'Posteingang');
      setTenantMailboxMode(Boolean(customEvent.detail?.tenantMailbox));
    };
    applyLabelFromLocation();
    window.addEventListener('popstate', applyLabelFromLocation);
    window.addEventListener('admin-mailbox-view', handleMailboxViewEvent as EventListener);
    return () => {
      window.removeEventListener('popstate', applyLabelFromLocation);
      window.removeEventListener('admin-mailbox-view', handleMailboxViewEvent as EventListener);
    };
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applySettingsTabFromLocation = () => {
      setSettingsTab(new URLSearchParams(window.location.search).get('tab') ?? '');
    };
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('a') : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      if (!target.href.includes('/admin/einstellungen')) return;
      window.setTimeout(applySettingsTabFromLocation, 0);
    };

    applySettingsTabFromLocation();
    window.addEventListener('popstate', applySettingsTabFromLocation);
    document.addEventListener('click', handleDocumentClick);

    return () => {
      window.removeEventListener('popstate', applySettingsTabFromLocation);
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [pathname]);

  useEffect(() => {
    setSettingsMenuOpen(false);
  }, [pathname, settingsTab]);

  useEffect(() => {
    if (requiredRole !== 'portal') {
      setPortalSidebarName('');
      return;
    }

    let cancelled = false;

    async function loadPortalSidebarName() {
      try {
        const response = await fetch('/api/portal/context', { cache: 'no-store' });
        const result = (await response.json()) as {
          ok?: boolean;
          targetData?: Record<string, unknown> | null;
        };

        if (!cancelled && response.ok && result.ok && result.targetData) {
          const fallbackType = profile?.targetType === 'contact' ? 'contact' : 'tenant';
          setPortalSidebarName(buildPortalDisplayName(fallbackType, result.targetData));
        }
      } catch (caughtError) {
        console.error('Fehler beim Laden des Portalnamens:', caughtError);
      }
    }

    void loadPortalSidebarName();
    return () => {
      cancelled = true;
    };
  }, [profile?.targetType, requiredRole]);

  useEffect(() => {
    return () => {
      if (settingsMenuCloseTimeoutRef.current) {
        clearTimeout(settingsMenuCloseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!role) {
      router.replace(getLoginRouteForRole(requiredRole));
      return;
    }

    if (role !== requiredRole) {
      router.replace(getDefaultRouteForRole(role));
    }
  }, [loading, requiredRole, role, router, user]);

  useEffect(() => {
    if (requiredRole !== 'admin') {
      return;
    }

    const unsubscribers = [
      onSnapshot(query(collection(db, 'companies')), (snapshot) => {
        setCompanies(
          snapshot.docs.map((documentSnapshot) => ({
            data: documentSnapshot.data(),
            id: documentSnapshot.id,
          }))
        );
      }),
      onSnapshot(query(collection(db, 'properties')), (snapshot) => {
        setProperties(
          snapshot.docs.map((documentSnapshot) => ({
            data: documentSnapshot.data(),
            id: documentSnapshot.id,
          }))
        );
      }),
      onSnapshot(query(collection(db, 'tenants')), (snapshot) => {
        setTenants(
          snapshot.docs.map((documentSnapshot) => ({
            data: documentSnapshot.data(),
            id: documentSnapshot.id,
          }))
        );
      }),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [requiredRole]);

  useEffect(() => {
    if (requiredRole !== 'admin' || loading || role !== 'admin' || !user) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }

    const currentUser = user;
    let isCancelled = false;
    let isSyncing = false;

    async function syncMailbox() {
      if (isSyncing) {
        return;
      }
      isSyncing = true;
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/inbound-email/sync', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          method: 'POST',
        });
        const result = (await response.json()) as {
          count?: number;
          emails?: SyncedInboundEmail[];
          error?: string;
          ok?: boolean;
        };
        if (!response.ok || !result.ok) {
          throw new Error(result.error || 'Mail-Sync fehlgeschlagen.');
        }
        if (!isCancelled) {
          let count = typeof result.count === 'number' ? result.count : 0;
          if (Array.isArray(result.emails) && result.emails.length > 0) {
            const imported = await persistInboundEmailsClient(result.emails);
            count = imported.count;
          }
          setMailSyncNote(
            count > 0 ? `${count} neue E-Mails wurden beim Einstieg übernommen.` : 'Postfach beim Einstieg synchronisiert.'
          );
        }
      } catch (error) {
        console.error('Fehler beim automatischen Mail-Sync:', error);
        if (!isCancelled) {
          setMailSyncNote('');
        }
      } finally {
        isSyncing = false;
      }
    }

    syncMailbox();
    const intervalId = window.setInterval(syncMailbox, 30000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [loading, requiredRole, role, user]);

  async function handleLogout() {
    if (user) {
      await signOut(auth);
    } else if (requiredRole === 'portal') {
      await fetch('/api/portal-local/logout', { method: 'POST' });
    }
    router.replace(getLoginRouteForRole(requiredRole));
  }

  function toggleSection(sectionKey: string) {
    setOpenSections((current) => ({
      Bestand: false,
      Hinzufuegen: false,
      [sectionKey]: !current[sectionKey],
    }));
  }

  function toggleCompany(companyId: string) {
    setOpenCompanies((current) => ({ [companyId]: !current[companyId] }));
  }

  function toggleProperty(propertyId: string) {
    setOpenProperties((current) => ({ [propertyId]: !current[propertyId] }));
  }

  function toggleUnit(unitKey: string) {
    setOpenUnits((current) => ({ [unitKey]: !current[unitKey] }));
  }

  function openCompany(companyId: string) {
    setOpenSections({ Bestand: true, Hinzufuegen: false });
    setOpenCompanies({ [companyId]: true });
    setOpenProperties({});
    setOpenUnits({});
    router.push(`/admin/firma/${companyId}`);
  }

  function openProperty(companyId: string, propertyId: string) {
    setOpenSections({ Bestand: true, Hinzufuegen: false });
    setOpenCompanies({ [companyId]: true });
    setOpenProperties({ [propertyId]: true });
    setOpenUnits({});
    router.push(`/admin/immobilie/${propertyId}`);
  }

  function openUnit(companyId: string, propertyId: string, unitId: string) {
    setOpenSections({ Bestand: true, Hinzufuegen: false });
    setOpenCompanies({ [companyId]: true });
    setOpenProperties({ [propertyId]: true });
    setOpenUnits({ [`${propertyId}-${unitId}`]: true });
    router.push(`/admin/einheit/${propertyId}/${unitId}`);
  }

  function openTenant(companyId: string, propertyId: string, unitId: string, tenantId: string) {
    setOpenSections({ Bestand: true, Hinzufuegen: false });
    setOpenCompanies({ [companyId]: true });
    setOpenProperties({ [propertyId]: true });
    setOpenUnits({ [`${propertyId}-${unitId}`]: true });
    router.push(`/admin/mieter/${tenantId}`);
  }

  const companyTree = useMemo(() => {
    if (requiredRole === 'admin' && !canReadCompanies && !canReadProperties && !canReadTenants) {
      return [];
    }

    const searchText = search.trim().toLowerCase();
    const sortedCompanies = [...companies].sort((left, right) =>
      cleanText(left.data.name).localeCompare(cleanText(right.data.name), 'de')
    );

    return sortedCompanies
      .map((company) => {
        const companyProperties = properties
          .filter((property) => cleanText(property.data.ownerId) === company.id)
          .sort((left, right) =>
            cleanText(left.data.name).localeCompare(cleanText(right.data.name), 'de')
          )
          .map((property) => {
            const propertyTenants = tenants
              .filter((tenant) => canReadTenants && cleanText(tenant.data.propertyId) === property.id)
              .sort((left, right) =>
                cleanText(right.data.moveInDate).localeCompare(cleanText(left.data.moveInDate), 'de')
              );

            const units = Array.isArray(property.data.units) ? property.data.units : [];
            const mappedUnits = units
              .map((unit) => {
                if (!unit || typeof unit !== 'object') return null;
                const unitId = cleanText(unit.id);
                if (!unitId) return null;
                const currentTenant =
                  propertyTenants.find(
                    (tenant) =>
                      cleanText(tenant.data.unitId) === unitId &&
                      cleanText(tenant.data.status) === 'active'
                  ) ??
                  propertyTenants.find((tenant) => cleanText(tenant.data.unitId) === unitId) ??
                  null;
                const pastTenants = propertyTenants.filter(
                  (tenant) =>
                    cleanText(tenant.data.unitId) === unitId &&
                    tenant.id !== currentTenant?.id
                );

                return {
                  currentTenant,
                  id: unitId,
                  label: unitDisplayLabel(unit),
                  menuLabel: unitMenuLabel(unit.floor, unit.unitPosition),
                  pastTenants,
                };
              })
              .filter(Boolean) as {
              currentTenant: AdminRecord | null;
              id: string;
              label: string;
              pastTenants: AdminRecord[];
            }[];

            return {
              id: property.id,
              label: cleanText(property.data.name) || property.id,
              units: canReadProperties || canReadTenants ? mappedUnits : [],
            };
          })
          .filter(() => canReadProperties || canReadTenants);

        if (!searchText) {
          return {
            id: company.id,
            label: cleanText(company.data.name) || company.id,
            properties: companyProperties,
          };
        }

        const matchingProperties = companyProperties
          .map((property) => ({
            ...property,
            units: property.units.filter((unit) => {
              const currentTenantName = unit.currentTenant
                ? [cleanText(unit.currentTenant.data.lastName), cleanText(unit.currentTenant.data.firstName)]
                    .filter(Boolean)
                    .join(', ')
                : '';
              const pastTenantNames = unit.pastTenants
                .map((tenant) =>
                  [cleanText(tenant.data.lastName), cleanText(tenant.data.firstName)]
                    .filter(Boolean)
                    .join(', ')
                )
                .join(' ');
              return [
                unit.label.toLowerCase(),
                currentTenantName.toLowerCase(),
                pastTenantNames.toLowerCase(),
              ].some((value) => value.includes(searchText));
            }),
          }))
          .filter((property) => {
            const propertyMatches = property.label.toLowerCase().includes(searchText);
            return propertyMatches || property.units.length > 0;
          });

        const companyMatches = (cleanText(company.data.name) || company.id)
          .toLowerCase()
          .includes(searchText);

        if (!companyMatches && matchingProperties.length === 0) {
          return null;
        }

        return {
          id: company.id,
          label: cleanText(company.data.name) || company.id,
          properties: companyMatches ? companyProperties : matchingProperties,
        };
      })
      .filter(Boolean) as {
      id: string;
      label: string;
      properties: {
        id: string;
        label: string;
        units: {
          currentTenant: AdminRecord | null;
          id: string;
          label: string;
          menuLabel: string;
          pastTenants: AdminRecord[];
        }[];
      }[];
    }[];
  }, [
    canReadCompanies,
    canReadProperties,
    canReadTenants,
    companies,
    properties,
    requiredRole,
    search,
    tenants,
  ]);

  const searchResults = useMemo(() => {
    const searchText = search.trim().toLowerCase();
    if (!searchText) return [];

    const companyResults: SearchResult[] = canReadCompanies
      ? companies
          .filter((company) => cleanText(company.data.name).toLowerCase().includes(searchText))
          .map((company) => ({
            companyId: company.id,
            label: cleanText(company.data.name) || company.id,
            type: 'company',
          }))
      : [];

    const propertyResults: SearchResult[] = canReadProperties
      ? properties
          .filter((property) => cleanText(property.data.name).toLowerCase().includes(searchText))
          .map((property) => ({
            companyId: cleanText(property.data.ownerId),
            label: cleanText(property.data.name) || property.id,
            propertyId: property.id,
            type: 'property',
          }))
      : [];

    const unitResults: SearchResult[] = canReadProperties
      ? properties.flatMap((property) => {
          const units = Array.isArray(property.data.units) ? property.data.units : [];
          return units
            .filter((unit) => unit && typeof unit === 'object')
            .map((unit) => ({
              companyId: cleanText(property.data.ownerId),
              label: unitDisplayLabel(unit),
              propertyId: property.id,
              type: 'unit' as const,
              unitId: cleanText(unit.id),
            }))
            .filter((unit) => unit.label.toLowerCase().includes(searchText));
        })
      : [];

    const tenantResults: SearchResult[] = canReadTenants
      ? tenants
          .map((tenant) => {
            const propertyId = cleanText(tenant.data.propertyId);
            const relatedProperty = properties.find((property) => property.id === propertyId);
            return {
              companyId: cleanText(relatedProperty?.data.ownerId),
              label: [cleanText(tenant.data.lastName), cleanText(tenant.data.firstName)]
                .filter(Boolean)
                .join(', '),
              propertyId,
              tenantId: tenant.id,
              type: 'tenant' as const,
              unitId: cleanText(tenant.data.unitId),
            };
          })
          .filter((tenant) => tenant.label.toLowerCase().includes(searchText))
      : [];

    return [...companyResults, ...propertyResults, ...unitResults, ...tenantResults].slice(0, 12);
  }, [canReadCompanies, canReadProperties, canReadTenants, companies, properties, search, tenants]);

  function revealSearchResult(result: SearchResult) {
    if (result.type === 'company' && result.companyId) {
      openCompany(result.companyId);
      return;
    }
    if (result.type === 'property' && result.companyId && result.propertyId) {
      openProperty(result.companyId, result.propertyId);
      return;
    }
    if (result.type === 'unit' && result.companyId && result.propertyId && result.unitId) {
      openUnit(result.companyId, result.propertyId, result.unitId);
      return;
    }
    if (
      result.type === 'tenant' &&
      result.companyId &&
      result.propertyId &&
      result.unitId &&
      result.tenantId
    ) {
      openTenant(result.companyId, result.propertyId, result.unitId, result.tenantId);
    }
  }

  function renderSettingsTrigger() {
    return (
      <button
        aria-label="Einstellungen öffnen"
        className="flex h-12 w-12 items-center justify-center drop-shadow-[0_10px_18px_rgba(148,119,77,0.28)] transition hover:scale-[1.02]"
        onClick={() => setSettingsMenuOpen((current) => !current)}
        type="button"
      >
        <svg aria-hidden="true" className="h-8 w-8" viewBox="0 0 24 24">
          <path
            d="M10.9 2.8h2.2l.6 2.2c.6.1 1.1.4 1.7.7l2-1.2 1.6 1.6-1.2 2c.3.5.5 1.1.7 1.7l2.2.6v2.2l-2.2.6c-.1.6-.4 1.1-.7 1.7l1.2 2-1.6 1.6-2-1.2c-.5.3-1.1.5-1.7.7l-.6 2.2h-2.2l-.6-2.2c-.6-.1-1.1-.4-1.7-.7l-2 1.2-1.6-1.6 1.2-2c-.3-.5-.5-1.1-.7-1.7l-2.2-.6v-2.2l2.2-.6c.1-.6.4-1.1.7-1.7l-1.2-2 1.6-1.6 2 1.2c.5-.3 1.1-.5 1.7-.7z"
            fill="#b48743"
            stroke="#6f4e2a"
            strokeLinejoin="round"
            strokeWidth="1.2"
          />
          <circle cx="12" cy="12" r="4.2" fill="#f8f1e5" stroke="#6f4e2a" strokeWidth="1.2" />
        </svg>
      </button>
    );
  }

  function openSettingsMenu() {
    if (settingsMenuCloseTimeoutRef.current) {
      clearTimeout(settingsMenuCloseTimeoutRef.current);
      settingsMenuCloseTimeoutRef.current = null;
    }
    setSettingsMenuOpen(true);
  }

  function closeSettingsMenuWithDelay() {
    if (settingsMenuCloseTimeoutRef.current) {
      clearTimeout(settingsMenuCloseTimeoutRef.current);
    }
    settingsMenuCloseTimeoutRef.current = setTimeout(() => {
      setSettingsMenuOpen(false);
      settingsMenuCloseTimeoutRef.current = null;
    }, 260);
  }

  function renderSettingsMenu() {
    if (visibleSettingsLinks.length === 0) return null;

    return (
      <div className="absolute -left-28 right-3 top-full pt-3">
        <div className="ml-auto w-72 rounded-[22px] border border-stone-200 bg-white p-3 shadow-[0_24px_60px_-34px_rgba(148,119,77,0.35)]">
          {visibleSettingsLinks.map((link, index) => (
            <Link
              className={`${index === 0 ? '' : 'mt-1 '}block rounded-[16px] px-4 py-3 text-sm text-slate-700 transition hover:bg-amber-50/70 hover:text-amber-900`}
              href={link.href}
              key={link.href}
              onClick={() => setSettingsMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(201,165,107,0.18),_transparent_30%),linear-gradient(180deg,_#f6f1ea_0%,_#f3ede4_100%)] px-6">
        <div className="rounded-[32px] border border-stone-200 bg-white/92 px-8 py-6 text-center shadow-[0_24px_60px_-38px_rgba(148,119,77,0.35)]">
          <p className="font-serif text-2xl text-slate-950">Zugang wird geprüft</p>
          <p className="mt-2 text-sm text-slate-600">
            Berechtigungen für den Bereich werden geladen.
          </p>
        </div>
      </div>
    );
  }

  if (role !== requiredRole || (requiredRole === 'admin' && !user)) {
    return null;
  }

  return (
    <div className="admin-shell min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(201,165,107,0.18),_transparent_30%),linear-gradient(180deg,_#f6f1ea_0%,_#f3ede4_100%)] text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[calc(320px-2cm)_minmax(0,1fr)]">
        <aside className="border-r border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,250,240,0.94)_0%,rgba(244,236,224,0.92)_100%)] px-6 py-8">
          <div className="flex h-full flex-col justify-between">
            <div>
              <div className="-mt-5 rounded-[26px] border border-stone-200/80 bg-white/72 px-4 py-3 shadow-[0_20px_40px_-34px_rgba(148,119,77,0.4)]">
                {canViewInventoryTree ? (
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
                    Interner Bereich
                  </p>
                ) : null}
                  <p
                    className={`font-serif text-slate-950 ${
                      requiredRole === 'admin'
                        ? 'mt-1.5 text-[1.55rem] leading-[1.1]'
                        : 'truncate text-[1.15rem] leading-tight'
                    }`}
                    title={sidebarTitle}
                  >
                    {sidebarTitle}
                  </p>
              </div>

              <div className="mt-3 space-y-3">
                <div className="p-0">
                  <input
                    className="w-full rounded-2xl border border-stone-300 bg-transparent px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-700/60"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Suchen"
                    type="search"
                    value={search}
                  />
                  {searchResults.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {searchResults.map((result) => (
                        <button
                          className="block w-full rounded-[18px] border border-stone-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-amber-700/30 hover:text-slate-950"
                          key={`${result.type}-${result.label}-${result.propertyId ?? ''}-${result.unitId ?? ''}-${result.tenantId ?? ''}`}
                          onClick={() => revealSearchResult(result)}
                          type="button"
                        >
                          <span className="block text-[10px] uppercase tracking-[0.22em] text-slate-400">
                            {result.type === 'company'
                              ? 'Firma'
                              : result.type === 'property'
                                ? 'Objekt'
                                : result.type === 'unit'
                                  ? 'Einheit'
                                  : 'Mieter'}
                          </span>
                          <span className="mt-1 block">{result.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <nav className="space-y-2">
                  {visibleNavSections[0]?.links.map((link) => {
                    const isActive = activeNavHref === link.href;

                    return (
                      <Link
                        className={`block px-3 py-2 text-xs leading-5 transition ${
                          isActive
                            ? 'rounded-[18px] border border-stone-200 bg-white text-slate-950 shadow-[0_18px_40px_-32px_rgba(148,119,77,0.45)]'
                            : 'text-slate-600 hover:text-slate-950'
                        }`}
                        href={link.href}
                        key={link.href}
                        title={link.label}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </nav>

                {requiredRole === 'admin' ? (
                  <div className={`${openSections.Bestand ?? false ? 'mt-4 rounded-[20px] p-2' : 'mt-4 px-1 py-1'}`}>
                    <button
                      className="flex w-full items-center justify-between px-2 py-2 text-left"
                      onClick={() => toggleSection('Bestand')}
                      type="button"
                    >
                      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                        Bestand
                      </span>
                      <span className="text-slate-500">
                        {openSections.Bestand ?? false ? '-' : '+'}
                      </span>
                    </button>

                    {openSections.Bestand ?? false ? (
                      <div className="mt-3 space-y-2">
                        {companyTree.length === 0 ? (
                          <div className="rounded-[18px] border border-dashed border-stone-300 bg-stone-50 px-3 py-3 text-sm text-slate-500">
                            Keine Firmen im Bestand gefunden.
                          </div>
                        ) : (
                          companyTree.map((company) => (
                            <div className="space-y-2" key={company.id}>
                              <div className="flex items-center gap-2">
                                <button
                                  className={`flex-1 rounded-[18px] px-3 py-2 text-left text-xs leading-5 font-medium transition ${
                                    isCurrentPath(pathname, `/admin/firma/${company.id}`)
                                      ? 'border border-stone-200 bg-white text-slate-950 shadow-[0_12px_28px_-24px_rgba(148,119,77,0.4)]'
                                      : 'border border-transparent bg-transparent text-slate-700 hover:bg-white/55'
                                  }`}
                                  onClick={() => openCompany(company.id)}
                                  title={company.label}
                                  type="button"
                                >
                                  {company.label}
                                </button>
                                <button
                                  aria-label={openCompanies[company.id] ?? false ? 'Firma einklappen' : 'Firma aufklappen'}
                                  className="px-1 py-2 text-sm text-slate-400 transition hover:text-slate-700"
                                  onClick={() => toggleCompany(company.id)}
                                  type="button"
                                >
                                  {openCompanies[company.id] ?? false ? '˄' : '˅'}
                                </button>
                              </div>
                              {openCompanies[company.id] ? (
                                <div className="ml-3 space-y-2 border-l border-stone-200 pl-3">
                                  {company.properties.map((property) => (
                                    <div className="space-y-2" key={property.id}>
                                      <div className="flex items-center gap-2">
                                        <button
                                          className={`flex-1 rounded-[16px] px-3 py-2 text-left text-xs leading-5 transition ${
                                            isCurrentPath(pathname, `/admin/immobilie/${property.id}`)
                                              ? 'border border-stone-200 bg-white text-slate-950 shadow-[0_12px_28px_-24px_rgba(148,119,77,0.4)]'
                                              : 'border border-transparent bg-transparent text-slate-700 hover:bg-white/55'
                                          }`}
                                          onClick={() => openProperty(company.id, property.id)}
                                          title={property.label}
                                          type="button"
                                        >
                                          {property.label}
                                        </button>
                                        <button
                                          aria-label={openProperties[property.id] ?? false ? 'Objekt einklappen' : 'Objekt aufklappen'}
                                          className="px-1 py-2 text-sm text-slate-400 transition hover:text-slate-700"
                                          onClick={() => toggleProperty(property.id)}
                                          type="button"
                                        >
                                          {openProperties[property.id] ?? false ? '˄' : '˅'}
                                        </button>
                                      </div>
                                      {openProperties[property.id] ? (
                                        <div className="ml-3 space-y-2 border-l border-stone-200 pl-3">
                                          {property.units.map((unit) => {
                                            const unitKey = `${property.id}-${unit.id}`;
                                            return (
                                              <div className="space-y-2" key={unitKey}>
                                                <div className="flex items-center gap-2">
                                                  <button
                                                    className={`flex-1 rounded-[14px] px-3 py-2 text-left text-xs leading-5 transition ${
                                                      isCurrentPath(pathname, `/admin/einheit/${property.id}/${unit.id}`)
                                                        ? 'border border-stone-200 bg-white text-slate-950 shadow-[0_12px_28px_-24px_rgba(148,119,77,0.4)]'
                                                        : 'border border-transparent bg-transparent text-slate-700 hover:bg-white/55'
                                                    }`}
                                                    onClick={() => openUnit(company.id, property.id, unit.id)}
                                                    title={unit.menuLabel}
                                                    type="button"
                                                  >
                                                    {unit.menuLabel}
                                                  </button>
                                                  <button
                                                    aria-label={openUnits[unitKey] ?? false ? 'Einheit einklappen' : 'Einheit aufklappen'}
                                                    className="px-1 py-2 text-sm text-slate-400 transition hover:text-slate-700"
                                                    onClick={() => toggleUnit(unitKey)}
                                                    type="button"
                                                  >
                                                    {openUnits[unitKey] ?? false ? '˄' : '˅'}
                                                  </button>
                                                </div>
                                                {openUnits[unitKey] ? (
                                                  <div className="ml-3 space-y-2 border-l border-stone-200 pl-3">
                                                    <div className="rounded-[14px] bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                                                      {unit.currentTenant ? (
                                                        <button
                                                          className={`flex items-center gap-2 text-left text-xs transition ${
                                                            isCurrentPath(pathname, `/admin/mieter/${unit.currentTenant!.id}`)
                                                              ? 'text-slate-950 underline decoration-stone-300 underline-offset-4'
                                                              : 'text-slate-700 hover:text-amber-800'
                                                          }`}
                                                          onClick={() => openTenant(company.id, property.id, unit.id, unit.currentTenant!.id)}
                                                          type="button"
                                                        >
                                                          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                                                          {[cleanText(unit.currentTenant.data.lastName), cleanText(unit.currentTenant.data.firstName)]
                                                            .filter(Boolean)
                                                            .join(', ')}
                                                        </button>
                                                      ) : (
                                                        <p className="mt-1 text-sm text-slate-900">Kein Mieter zugeordnet</p>
                                                      )}
                                                    </div>
                                                    {unit.pastTenants.length > 0 ? (
                                                      <div className="rounded-[14px] bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                                                        <p className="uppercase tracking-[0.22em] text-slate-400">
                                                          Letzte Mieter
                                                        </p>
                                                        <div className="mt-2 space-y-1.5">
                                                          {unit.pastTenants.map((tenant) => (
                                                            <button
                                                              className={`block text-left text-xs transition ${
                                                                isCurrentPath(pathname, `/admin/mieter/${tenant.id}`)
                                                                  ? 'text-slate-950 underline decoration-stone-300 underline-offset-4'
                                                                  : 'text-slate-700 hover:text-amber-800'
                                                              }`}
                                                              key={tenant.id}
                                                              onClick={() => openTenant(company.id, property.id, unit.id, tenant.id)}
                                                              type="button"
                                                            >
                                                              {[cleanText(tenant.data.lastName), cleanText(tenant.data.firstName)]
                                                                .filter(Boolean)
                                                                .join(', ')}
                                                            </button>
                                                          ))}
                                                        </div>
                                                      </div>
                                                    ) : null}
                                                  </div>
                                                ) : null}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}

              </div>

              <nav className="mt-4 space-y-4">
                {visibleNavSections.slice(1).map((section) => (
                  <div key={section.label ?? section.links.map((link) => link.href).join('|')}>
                    {section.label ? (
                      <button
                        className="mb-2 flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-700"
                        onClick={() => toggleSection(section.label!)}
                        type="button"
                      >
                        <span>{section.label}</span>
                        <span className="text-slate-500">
                          {openSections[section.label] ?? true ? '-' : '+'}
                        </span>
                      </button>
                    ) : null}

                    <div className={`space-y-2 ${section.label && !(openSections[section.label] ?? true) ? 'hidden' : ''}`}>
                      {section.links.map((link) => {
                        const isActive = activeNavHref === link.href;

                        return (
                          <Link
                          className={`block px-3 py-2 text-xs leading-5 transition ${
                              isActive
                                ? 'rounded-[18px] border border-stone-200 bg-white text-slate-950 shadow-[0_18px_40px_-32px_rgba(148,119,77,0.45)]'
                                : 'text-slate-600 hover:text-slate-950'
                            }`}
                            href={link.href}
                            key={link.href}
                            title={link.label}
                          >
                            {link.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </div>

            <div className="space-y-0">
              <Link className="-mb-20 flex items-center justify-center" href="/">
                <Image
                  alt="Halbmann Holding"
                  className="h-56 w-auto object-contain"
                  height={360}
                  src="/halbmann-logo.png"
                  width={1000}
                />
              </Link>
              <div className="rounded-[28px] border border-stone-200/80 bg-white/72 px-4 py-2 shadow-[0_24px_50px_-36px_rgba(148,119,77,0.42)]">
                <p className="break-words text-center text-[11px] leading-4 text-slate-700">
                  {user?.email || profile?.contactEmail || profile?.username || ''}
                </p>
                <button
                className="mt-1 w-full rounded-full bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] px-4 py-2 text-sm font-medium text-stone-100 transition hover:brightness-105"
                onClick={handleLogout}
                type="button"
              >
                Abmelden
              </button>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          {!isCompactHeaderRoute && requiredRole === 'admin' ? (
          <header
            className={`relative z-30 border-b border-stone-200/80 bg-white/45 backdrop-blur xl:px-10 ${
              resolvedHeaderContent.title || resolvedHeaderContent.description || (mailSyncNote && requiredRole === 'admin')
                ? 'px-6 py-4'
                : 'px-6 py-2'
            }`}
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                {resolvedHeaderContent.title ? <h1 className="font-serif text-3xl text-slate-950">{resolvedHeaderContent.title}</h1> : null}
                {resolvedHeaderContent.description ? (
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{resolvedHeaderContent.description}</p>
                ) : null}
                {mailSyncNote &&
                requiredRole === 'admin' &&
                pathname !== '/admin/nachrichten' &&
                !pathname.startsWith('/admin/nachrichten/') ? (
                  <p className="mt-3 text-sm text-emerald-700">{mailSyncNote}</p>
                ) : null}
              </div>
              {requiredRole === 'admin' && visibleSettingsLinks.length > 0 ? (
                <div
                  className="relative z-40"
                  onMouseEnter={openSettingsMenu}
                  onMouseLeave={closeSettingsMenuWithDelay}
                >
                  {renderSettingsTrigger()}
                  {settingsMenuOpen ? renderSettingsMenu() : null}
                </div>
              ) : null}
            </div>
          </header>
          ) : requiredRole === 'admin' ? (
            <div
              className={`pointer-events-none relative z-40 flex justify-end px-6 xl:px-10 ${
                isTenantDetailRoute ? 'pt-2 mb-0' : 'pt-3 -mb-11'
              }`}
            >
              {requiredRole === 'admin' && visibleSettingsLinks.length > 0 ? (
                <div
                  className="pointer-events-auto relative z-40"
                  onMouseEnter={openSettingsMenu}
                  onMouseLeave={closeSettingsMenuWithDelay}
                >
                  {renderSettingsTrigger()}
                  {settingsMenuOpen ? renderSettingsMenu() : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <main
            className={`flex-1 px-6 ${
              isTenantDetailRoute ? 'pt-0 pb-2' : isCompactHeaderRoute ? 'py-2' : 'py-8'
            } xl:px-10`}
          >
            {canViewCurrentAdminPage ? (
              children
            ) : (
              <section className="rounded-[28px] border border-stone-200 bg-white p-8 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">
                  Kein Zugriff
                </p>
                <h2 className="mt-2 text-3xl text-slate-950">Dieser Bereich ist nicht freigegeben.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                  Ein Super Admin kann den Zugriff unter Einstellungen / Mitarbeiter beim jeweiligen
                  Mitarbeiter aktivieren.
                </p>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}





