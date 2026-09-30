import { useState } from 'react';
import { EmployeePhoto } from '../components/EmployeePhoto';
import { useEssData } from '../mock/EssDataContext';
import { ORGANIZATION, type EssProfile, type ProfileFamilyMember } from '../mock/essMock';

function show(value: string) {
  return value.trim() ? value : '—';
}

export function EssProfilePage() {
  const { profile } = useEssData();
  const [familyOpen, setFamilyOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  return (
    <div className="ess-profile ess-section-stack">
      <header className="ess-home-hero">
        <div className="ess-home-hero-person">
          <EmployeePhoto
            src={profile.photo}
            name={`${profile.firstName} ${profile.lastName}`}
            size="lg"
          />
          <div>
            <p className="ess-greeting">
              {profile.firstName} {profile.lastName}
            </p>
            <p className="ess-lead">
              {profile.employeeCode} · {profile.title}
            </p>
          </div>
        </div>
      </header>
      <PersonalSection profile={profile} />
      <AccountsSection profile={profile} />
      <FamilySection
        members={profile.family}
        open={familyOpen}
        onToggle={() => setFamilyOpen((value) => !value)}
      />
      <EmploymentSection
        profile={profile}
        timelineOpen={timelineOpen}
        onToggleTimeline={() => setTimelineOpen((value) => !value)}
      />
      <AssetsSection profile={profile} />
    </div>
  );
}

function FieldList({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="ess-dl">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{show(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function EmptyNote() {
  return <p className="ess-empty">No data found.</p>;
}

function PersonalSection({ profile }: { profile: EssProfile }) {
  return (
    <div className="ess-section-stack">
      <section className="ess-panel">
        <h2>Profile</h2>
        <FieldList
          rows={[
            ['Name', `${profile.firstName} ${profile.lastName}`],
            ['Employee ID', profile.employeeCode],
            ['Company Email', profile.workEmail],
            ['Location', profile.location],
            ['Primary Contact No.', profile.workPhone],
            ['Extension', profile.extension],
          ]}
        />
      </section>

      <section className="ess-panel">
        <h2>Personal</h2>
        <FieldList
          rows={[
            ['Blood Group', profile.bloodGroup],
            ['Date of Birth', profile.dateOfBirth],
            ['Nationality', profile.nationality],
            ['Marital Status', profile.maritalStatus],
            ['Marriage Date', profile.marriageDate],
            ['Spouse', profile.spouse],
            ['Place of Birth', profile.placeOfBirth],
            ['Residential Status', profile.residentialStatus],
            ['Father Name', profile.fatherName],
            ['Religion', profile.religion],
            ['Physically Challenged', profile.physicallyChallenged],
            ['International Employee', profile.internationalEmployee],
            ['Height', profile.height],
            ['Weight', profile.weight],
            ['Identification Mark', profile.identificationMark],
          ]}
        />
      </section>

      <section className="ess-panel">
        <h2>Address</h2>
        <FieldList
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
      </section>

      <section className="ess-panel">
        <h2>Education</h2>
        {profile.education.length === 0 ? <EmptyNote /> : null}
      </section>
    </div>
  );
}

function AccountsSection({ profile }: { profile: EssProfile }) {
  return (
    <div className="ess-section-stack">
      <section className="ess-panel">
        <h2>Bank Account</h2>
        <FieldList
          rows={[
            ['Bank Name', profile.bankName],
            ['Bank Account Number', profile.bankAccountNumber],
            ['Bank Branch', profile.bankBranch],
          ]}
        />
      </section>

      <section className="ess-panel">
        <h2>PF Account</h2>
        <p className="ess-profile-note">{profile.pfAccount}</p>
      </section>

      <section className="ess-panel">
        <h2>Other IDs</h2>
        <ul className="ess-profile-ids">
          {profile.statutoryIds.map((item) => (
            <li key={item.label} className="ess-profile-id">
              <div>
                <p className="ess-muted">{item.label}</p>
                <p className="ess-profile-id-value">{item.value}</p>
              </div>
              {item.unverified ? (
                <span className="ess-chip ess-chip-withdrawn">Unverified</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FamilySection({
  members,
  open,
  onToggle,
}: {
  members: ProfileFamilyMember[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="ess-section-stack">
      {members.map((member) => (
        <section key={member.relation} className="ess-panel">
          <h2>{member.relation}</h2>
          <FieldList rows={[['Name', member.name]]} />
          <button type="button" className="ess-btn ess-btn-ghost" onClick={onToggle}>
            {open ? 'Hide details' : 'See details'}
          </button>
          {open ? (
            <FieldList
              rows={[
                ['Date of Birth', member.dateOfBirth],
                ['Blood Group', member.bloodGroup],
                ['Gender', member.gender],
                ['Nationality', member.nationality],
              ]}
            />
          ) : null}
        </section>
      ))}
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
    <div className="ess-section-stack">
      <section className="ess-panel">
        <div className="ess-panel-head">
          <h2>Current Position</h2>
          <button type="button" className="ess-btn ess-btn-ghost" onClick={onToggleTimeline}>
            {timelineOpen ? 'Hide timeline' : 'View timeline'}
          </button>
        </div>
        <FieldList
          rows={[
            ['Organization', ORGANIZATION.name],
            ['Organization code', ORGANIZATION.code],
            ['Cost Center', profile.costCenter],
            ['Department', profile.department],
            ['Team', profile.teamName],
            ['Designation', profile.title],
            ['Division', profile.division],
            ['Grade', profile.grade],
            ['Location', profile.location],
            ['Reporting To', profile.managerName],
            ['Shift', profile.shift],
            ['Web Login', profile.webLogin],
          ]}
        />
        {timelineOpen ? (
          <div className="ess-profile-timeline">
            <p className="ess-profile-note">
              {profile.title} · {profile.department} · {profile.location}
            </p>
            <h3 className="ess-home-kicker">Previous</h3>
            {profile.previousPositions.length === 0 ? <EmptyNote /> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function AssetsSection({ profile }: { profile: EssProfile }) {
  return (
    <div className="ess-section-stack">
      <section className="ess-panel">
        <h2>Access card details</h2>
        <FieldList
          rows={[
            ['Card No', profile.accessCardNo],
            ['Validity', profile.accessCardValidity],
          ]}
        />
      </section>
      <section className="ess-panel">
        <h2>Previous</h2>
        {profile.previousAssets.length === 0 ? <EmptyNote /> : null}
      </section>
    </div>
  );
}
