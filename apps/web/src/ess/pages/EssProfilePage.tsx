import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BadgeCheck,
  Briefcase,
  Building2,
  CreditCard,
  IdCard,
  MapPin,
  Shield,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { EmployeePhoto } from '../components/EmployeePhoto';
import { useEssData } from '../mock/EssDataContext';
import { ORGANIZATION, type EssProfile, type ProfileFamilyMember } from '../mock/essMock';
import { categoryLabel, fetchMyAssets, type MyAsset } from '../../workspace/assetsApi';

type Section = 'overview' | 'personal' | 'accounts' | 'family' | 'employment' | 'assets';

const SECTIONS: Array<{ id: Section; label: string; hint: string; icon: LucideIcon }> = [
  { id: 'overview', label: 'Overview', hint: 'At a glance', icon: UserRound },
  { id: 'personal', label: 'Personal', hint: 'Identity & address', icon: IdCard },
  { id: 'accounts', label: 'Accounts', hint: 'Bank & IDs', icon: CreditCard },
  { id: 'family', label: 'Family', hint: 'Dependents', icon: Users },
  { id: 'employment', label: 'Employment', hint: 'Role & org', icon: Briefcase },
  { id: 'assets', label: 'Assets', hint: 'Access & devices', icon: Shield },
];

function show(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : '—';
}

function filledCount(values: string[]) {
  return values.filter((value) => value.trim().length > 0).length;
}

export function EssProfilePage() {
  const { profile } = useEssData();
  const [section, setSection] = useState<Section>('overview');
  const [openFamily, setOpenFamily] = useState<string | null>(profile.family[0]?.relation ?? null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const unverifiedIds = profile.statutoryIds.filter((item) => item.unverified).length;
  const personalFilled = filledCount([
    profile.bloodGroup,
    profile.dateOfBirth,
    profile.nationality,
    profile.maritalStatus,
    profile.fatherName,
    profile.address.lines,
  ]);

  return (
    <div className="ess-profile ess-section-stack">
      <header className="ess-profile-hero">
        <div className="ess-profile-hero-person">
          <EmployeePhoto src={profile.photo} name={fullName} size="xl" />
          <div className="ess-profile-hero-copy">
            <p className="ess-profile-kicker">
              <UserRound size={14} aria-hidden /> My profile
            </p>
            <h1>{fullName}</h1>
            <p className="ess-lead">
              {profile.title}
              {profile.department ? ` · ${profile.department}` : ''}
            </p>
            <div className="ess-profile-chips" aria-label="Profile highlights">
              <span className="ess-profile-chip">
                <IdCard size={13} aria-hidden />
                {profile.employeeCode}
              </span>
              <span className="ess-profile-chip">
                <MapPin size={13} aria-hidden />
                {show(profile.location)}
              </span>
              <span className="ess-profile-chip">
                <Building2 size={13} aria-hidden />
                {show(profile.teamName)}
              </span>
              <span className="ess-profile-chip">
                <Briefcase size={13} aria-hidden />
                Reports to {show(profile.managerName)}
              </span>
            </div>
          </div>
        </div>
        <div className="ess-profile-hero-stats" aria-label="Profile summary">
          <article className="ess-profile-stat">
            <span className="ess-profile-stat-label">Grade</span>
            <strong>{show(profile.grade)}</strong>
            <span className="ess-muted">{show(profile.shift)}</span>
          </article>
          <article className="ess-profile-stat">
            <span className="ess-profile-stat-label">Personal</span>
            <strong>
              {personalFilled}
              <span>/6</span>
            </strong>
            <span className="ess-muted">Key fields filled</span>
          </article>
          <article className="ess-profile-stat">
            <span className="ess-profile-stat-label">IDs</span>
            <strong>{profile.statutoryIds.length}</strong>
            <span className="ess-muted">
              {unverifiedIds > 0 ? `${unverifiedIds} unverified` : 'All verified'}
            </span>
          </article>
          <article className="ess-profile-stat">
            <span className="ess-profile-stat-label">Family</span>
            <strong>{profile.family.length}</strong>
            <span className="ess-muted">{profile.family.length === 1 ? 'member' : 'members'}</span>
          </article>
        </div>
      </header>

      <nav className="ess-profile-tabs" role="tablist" aria-label="Profile sections">
        {SECTIONS.map(({ id, label, hint, icon: Icon }) => {
          const active = section === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`ess-profile-tab${active ? ' is-active' : ''}`}
              onClick={() => setSection(id)}
            >
              <span className="ess-profile-tab-icon" aria-hidden>
                <Icon size={16} strokeWidth={2.1} />
              </span>
              <span className="ess-profile-tab-copy">
                <span className="ess-profile-tab-label">{label}</span>
                <span className="ess-profile-tab-hint">{hint}</span>
              </span>
            </button>
          );
        })}
      </nav>

      {section === 'overview' ? <OverviewSection profile={profile} onOpen={setSection} /> : null}
      {section === 'personal' ? <PersonalSection profile={profile} /> : null}
      {section === 'accounts' ? <AccountsSection profile={profile} /> : null}
      {section === 'family' ? (
        <FamilySection
          members={profile.family}
          openRelation={openFamily}
          onToggle={(relation) =>
            setOpenFamily((current) => (current === relation ? null : relation))
          }
        />
      ) : null}
      {section === 'employment' ? (
        <EmploymentSection
          profile={profile}
          timelineOpen={timelineOpen}
          onToggleTimeline={() => setTimelineOpen((value) => !value)}
        />
      ) : null}
      {section === 'assets' ? <AssetsSection /> : null}
    </div>
  );
}

function FieldGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="ess-profile-fields">
      {rows.map(([label, value]) => (
        <div key={label} className="ess-profile-field">
          <dt>{label}</dt>
          <dd>{show(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ess-panel ess-profile-card">
      <div className="ess-panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="ess-muted ess-profile-card-sub">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyNote({ label = 'No data found.' }: { label?: string }) {
  return <p className="ess-empty">{label}</p>;
}

function OverviewSection({
  profile,
  onOpen,
}: {
  profile: EssProfile;
  onOpen: (section: Section) => void;
}) {
  const quickLinks = useMemo(
    () =>
      [
        {
          id: 'personal' as const,
          title: 'Personal details',
          body: 'Blood group, DOB, nationality, and residential address.',
        },
        {
          id: 'accounts' as const,
          title: 'Bank & statutory IDs',
          body: `${profile.bankName || 'Bank'} · ${profile.statutoryIds.length} ID records`,
        },
        {
          id: 'employment' as const,
          title: 'Current position',
          body: `${profile.title} in ${profile.department || 'your department'}`,
        },
        {
          id: 'family' as const,
          title: 'Family',
          body:
            profile.family.length === 0
              ? 'No dependents on file'
              : profile.family.map((member) => member.relation).join(', '),
        },
      ] as const,
    [profile],
  );

  return (
    <div className="ess-profile-overview">
      <SectionCard title="Contact" subtitle="Work channels used across PeopleOS">
        <FieldGrid
          rows={[
            ['Company email', profile.workEmail],
            ['Work phone', profile.workPhone],
            ['Extension', profile.extension],
            ['Personal mobile', profile.contacts.mobile],
            ['Personal email', profile.contacts.personalEmail],
            ['Emergency contact', `${profile.contacts.emergencyName} (${profile.contacts.emergencyRelation})`],
            ['Emergency phone', profile.contacts.emergencyPhone],
          ]}
        />
      </SectionCard>

      <div className="ess-profile-quick">
        {quickLinks.map((item) => (
          <button
            key={item.id}
            type="button"
            className="ess-profile-quick-card"
            onClick={() => onOpen(item.id)}
          >
            <strong>{item.title}</strong>
            <span className="ess-muted">{item.body}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PersonalSection({ profile }: { profile: EssProfile }) {
  return (
    <div className="ess-profile-stack">
      <SectionCard title="Identity" subtitle="Core employee identity on record">
        <FieldGrid
          rows={[
            ['Name', `${profile.firstName} ${profile.lastName}`],
            ['Employee ID', profile.employeeCode],
            ['Company email', profile.workEmail],
            ['Location', profile.location],
            ['Primary contact', profile.workPhone],
            ['Extension', profile.extension],
          ]}
        />
      </SectionCard>

      <SectionCard title="Personal" subtitle="Biographic details maintained by HR">
        <FieldGrid
          rows={[
            ['Blood group', profile.bloodGroup],
            ['Date of birth', profile.dateOfBirth],
            ['Nationality', profile.nationality],
            ['Marital status', profile.maritalStatus],
            ['Marriage date', profile.marriageDate],
            ['Spouse', profile.spouse],
            ['Place of birth', profile.placeOfBirth],
            ['Residential status', profile.residentialStatus],
            ['Father name', profile.fatherName],
            ['Religion', profile.religion],
            ['Physically challenged', profile.physicallyChallenged],
            ['International employee', profile.internationalEmployee],
            ['Height', profile.height],
            ['Weight', profile.weight],
            ['Identification mark', profile.identificationMark],
          ]}
        />
      </SectionCard>

      <SectionCard title="Address" subtitle="Residential / correspondence address">
        <FieldGrid
          rows={[
            ['Address', profile.address.lines],
            ['Name', profile.address.name],
            ['Email', profile.address.email],
            ['Phone 1', profile.address.phone1],
            ['Phone 2', profile.address.phone2],
            ['Mobile', profile.address.mobile],
            ['Extension', profile.address.extension],
            ['Fax', profile.address.fax],
          ]}
        />
      </SectionCard>

      <SectionCard title="Education">
        {profile.education.length === 0 ? (
          <EmptyNote label="No education records yet." />
        ) : (
          <ul className="ess-profile-list">
            {profile.education.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function AccountsSection({ profile }: { profile: EssProfile }) {
  return (
    <div className="ess-profile-stack">
      <SectionCard title="Bank account" subtitle="Salary credit details">
        <FieldGrid
          rows={[
            ['Bank name', profile.bankName],
            ['Account number', profile.bankAccountNumber],
            ['Branch', profile.bankBranch],
          ]}
        />
      </SectionCard>

      <SectionCard title="PF account">
        <p className="ess-profile-note">{show(profile.pfAccount)}</p>
      </SectionCard>

      <SectionCard title="Other IDs" subtitle="Statutory and identity documents">
        <ul className="ess-profile-ids">
          {profile.statutoryIds.map((item) => (
            <li key={item.label} className="ess-profile-id">
              <div>
                <p className="ess-muted">{item.label}</p>
                <p className="ess-profile-id-value">{item.value}</p>
              </div>
              {item.unverified ? (
                <span className="ess-chip ess-chip-withdrawn">Unverified</span>
              ) : (
                <span className="ess-chip ess-chip-approved">
                  <BadgeCheck size={12} aria-hidden /> Verified
                </span>
              )}
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

function FamilySection({
  members,
  openRelation,
  onToggle,
}: {
  members: ProfileFamilyMember[];
  openRelation: string | null;
  onToggle: (relation: string) => void;
}) {
  if (members.length === 0) {
    return (
      <SectionCard title="Family">
        <EmptyNote label="No family members on file." />
      </SectionCard>
    );
  }

  return (
    <div className="ess-profile-family">
      {members.map((member) => {
        const open = openRelation === member.relation;
        return (
          <section key={member.relation} className="ess-panel ess-profile-family-card">
            <div className="ess-profile-family-head">
              <div>
                <p className="ess-muted">{member.relation}</p>
                <h2>{show(member.name)}</h2>
              </div>
              <button type="button" className="ess-btn" onClick={() => onToggle(member.relation)}>
                {open ? 'Hide details' : 'See details'}
              </button>
            </div>
            {open ? (
              <FieldGrid
                rows={[
                  ['Date of birth', member.dateOfBirth],
                  ['Blood group', member.bloodGroup],
                  ['Gender', member.gender],
                  ['Nationality', member.nationality],
                ]}
              />
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function EmploymentSection({
  profile,
  timelineOpen,
  onToggleTimeline,
}: {
  profile: EssProfile;
  timelineOpen: boolean;
  onToggleTimeline: () => void;
}) {
  return (
    <div className="ess-profile-stack">
      <SectionCard
        title="Current position"
        subtitle="Organization placement and reporting line"
        action={
          <button type="button" className="ess-btn ess-btn-ghost" onClick={onToggleTimeline}>
            {timelineOpen ? 'Hide timeline' : 'View timeline'}
          </button>
        }
      >
        <FieldGrid
          rows={[
            ['Organization', ORGANIZATION.name],
            ['Organization code', ORGANIZATION.code],
            ['Cost center', profile.costCenter],
            ['Department', profile.department],
            ['Team', profile.teamName],
            ['Designation', profile.title],
            ['Division', profile.division],
            ['Grade', profile.grade],
            ['Location', profile.location],
            ['Reporting to', profile.managerName],
            ['Shift', profile.shift],
            ['Web login', profile.webLogin],
          ]}
        />
        {timelineOpen ? (
          <div className="ess-profile-timeline">
            <div className="ess-profile-timeline-item is-current">
              <span className="ess-profile-timeline-dot" aria-hidden />
              <div>
                <strong>Current</strong>
                <p className="ess-muted">
                  {profile.title} · {profile.department} · {profile.location}
                </p>
              </div>
            </div>
            <h3 className="ess-profile-timeline-label">Previous</h3>
            {profile.previousPositions.length === 0 ? (
              <EmptyNote label="No previous positions recorded." />
            ) : (
              <ul className="ess-profile-list">
                {profile.previousPositions.map((item) => (
                  <li key={item} className="ess-profile-timeline-item">
                    <span className="ess-profile-timeline-dot" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

function AssetsSection() {
  const [assets, setAssets] = useState<MyAsset[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyAssets()
      .then((rows) => {
        setAssets(rows);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load assets.'));
  }, []);

  return (
    <div className="ess-profile-stack">
      <SectionCard title="Access card" subtitle="Building / campus access">
        <ProfileAccessCard />
      </SectionCard>
      <SectionCard
        title="Currently assigned"
        subtitle="Past holders stay with IT. You only see what you have now."
        action={
          <Link to="/ess/assets" className="ess-btn">
            Manage with IT
          </Link>
        }
      >
        {error ? <p className="ess-alert">{error}</p> : null}
        {assets.length === 0 ? <EmptyNote label="Nothing is assigned to you right now." /> : null}
        <ul className="ess-asset-list">
          {assets.map((asset) => (
            <li key={asset.assetId} className="ess-asset-card">
              <div>
                <strong>{asset.assetTag}</strong>
                <p>{asset.makeModel || categoryLabel(asset.category)}</p>
              </div>
              <dl>
                <div>
                  <dt>Serial</dt>
                  <dd>{asset.serialNo || '—'}</dd>
                </div>
                <div>
                  <dt>Since</dt>
                  <dd>{asset.assignedOn}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

function ProfileAccessCard() {
  const { profile } = useEssData();
  return (
    <FieldGrid
      rows={[
        ['Card no.', profile.accessCardNo],
        ['Validity', profile.accessCardValidity],
      ]}
    />
  );
}
