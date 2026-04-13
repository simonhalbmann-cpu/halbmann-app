import Link from 'next/link';
import AdminAiSettings from '../../../components/admin/AdminAiSettings';
import AdminLetterSettings from '../../../components/admin/AdminLetterSettings';
import AdminMailboxSettings from '../../../components/admin/AdminMailboxSettings';
import AdminSignatureSettings from '../../../components/admin/AdminSignatureSettings';

type SettingsTab = 'brief' | 'ki' | 'postfach' | 'signaturen';
type BriefSubTab = 'abschluss' | 'anrede' | 'vorlage';

function TabLink({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <Link
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? 'bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] text-stone-100'
          : 'border border-stone-300 bg-white text-slate-700 hover:border-stone-400'
      }`}
      href={href}
      scroll={false}
    >
      {label}
    </Link>
  );
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ sub?: BriefSubTab; tab?: SettingsTab }>;
}) {
  const resolvedSearchParams = await searchParams;
  const currentTab: SettingsTab =
    resolvedSearchParams.tab === 'brief'
      ? 'brief'
      : resolvedSearchParams.tab === 'signaturen'
      ? 'signaturen'
      : resolvedSearchParams.tab === 'ki'
        ? 'ki'
        : 'postfach';
  const currentBriefSubTab: BriefSubTab =
    resolvedSearchParams.sub === 'anrede'
      ? 'anrede'
      : resolvedSearchParams.sub === 'abschluss'
        ? 'abschluss'
        : 'vorlage';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <TabLink active={currentTab === 'postfach'} href="/admin/einstellungen" label="Postfach-Zugang" />
        <TabLink active={currentTab === 'ki'} href="/admin/einstellungen?tab=ki" label="KI" />
        <TabLink active={currentTab === 'brief'} href="/admin/einstellungen?tab=brief" label="Brief" />
        <TabLink
          active={currentTab === 'signaturen'}
          href="/admin/einstellungen?tab=signaturen"
          label="Signaturen"
        />
      </div>

      {currentTab === 'brief' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <TabLink
              active={currentBriefSubTab === 'vorlage'}
              href="/admin/einstellungen?tab=brief&sub=vorlage"
              label="Briefvorlage"
            />
            <TabLink
              active={currentBriefSubTab === 'anrede'}
              href="/admin/einstellungen?tab=brief&sub=anrede"
              label="Anrede"
            />
            <TabLink
              active={currentBriefSubTab === 'abschluss'}
              href="/admin/einstellungen?tab=brief&sub=abschluss"
              label="Abschluss"
            />
          </div>
          <AdminLetterSettings view={currentBriefSubTab} />
        </div>
      ) : currentTab === 'signaturen' ? (
        <div className="space-y-6">
          <AdminSignatureSettings />
          <AdminMailboxSettings mode="layout" />
        </div>
      ) : currentTab === 'ki' ? (
        <AdminAiSettings />
      ) : (
        <AdminMailboxSettings mode="credentials" />
      )}
    </div>
  );
}
