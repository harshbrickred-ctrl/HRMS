import { useState, type FormEvent } from 'react';
import { useEssData } from '../mock/EssDataContext';
import type { ProfileContacts } from '../mock/essMock';

type Tab = 'personal' | 'job' | 'contacts';

export function EssProfilePage() {
  const { profile, updateContacts } = useEssData();
  const [tab, setTab] = useState<Tab>('personal');
  const [contacts, setContacts] = useState<ProfileContacts>(profile.contacts);
  const [dirty, setDirty] = useState(false);

  function setField<K extends keyof ProfileContacts>(key: K, value: string) {
    setContacts((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function onSave(e: FormEvent) {
    e.preventDefault();
    updateContacts(contacts);
    setDirty(false);
  }

  return (
    <div>
      <p className="ess-lead">
        Personal details, job information, and contacts. Job fields are
        read-only.
      </p>

      <div className="ess-tabs" role="tablist">
        {(
          [
            ['personal', 'Personal'],
            ['job', 'Job'],
            ['contacts', 'Contacts'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'ess-tab is-active' : 'ess-tab'}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'personal' ? (
        <section className="ess-panel">
          <h2>Personal</h2>
          <dl className="ess-dl">
            <div>
              <dt>Employee code</dt>
              <dd>{profile.employeeCode}</dd>
            </div>
            <div>
              <dt>Name</dt>
              <dd>
                {profile.firstName} {profile.lastName}
              </dd>
            </div>
            <div>
              <dt>Date of birth</dt>
              <dd>{profile.dateOfBirth}</dd>
            </div>
            <div>
              <dt>Gender</dt>
              <dd>{profile.gender}</dd>
            </div>
            <div>
              <dt>Nationality</dt>
              <dd>{profile.nationality}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {tab === 'job' ? (
        <section className="ess-panel">
          <h2>Job</h2>
          <dl className="ess-dl">
            <div>
              <dt>Title</dt>
              <dd>{profile.title}</dd>
            </div>
            <div>
              <dt>Department</dt>
              <dd>{profile.department}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{profile.location}</dd>
            </div>
            <div>
              <dt>Join date</dt>
              <dd>{profile.joinDate}</dd>
            </div>
            <div>
              <dt>Employment type</dt>
              <dd>{profile.employmentType}</dd>
            </div>
            <div>
              <dt>Manager</dt>
              <dd>{profile.managerName}</dd>
            </div>
            <div>
              <dt>Work email</dt>
              <dd>{profile.workEmail}</dd>
            </div>
            <div>
              <dt>Work phone</dt>
              <dd>{profile.workPhone}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {tab === 'contacts' ? (
        <section className="ess-panel">
          <h2>Contacts</h2>
          <form className="ess-form" onSubmit={onSave}>
            <div className="ess-field">
              <label htmlFor="mobile">Mobile *</label>
              <input
                id="mobile"
                value={contacts.mobile}
                onChange={(e) => setField('mobile', e.target.value)}
                required
              />
            </div>
            <div className="ess-field">
              <label htmlFor="personal-email">Personal email</label>
              <input
                id="personal-email"
                type="email"
                value={contacts.personalEmail}
                onChange={(e) => setField('personalEmail', e.target.value)}
              />
            </div>
            <div className="ess-field">
              <label htmlFor="em-name">Emergency contact name *</label>
              <input
                id="em-name"
                value={contacts.emergencyName}
                onChange={(e) => setField('emergencyName', e.target.value)}
                required
              />
            </div>
            <div className="ess-field">
              <label htmlFor="em-phone">Emergency phone *</label>
              <input
                id="em-phone"
                value={contacts.emergencyPhone}
                onChange={(e) => setField('emergencyPhone', e.target.value)}
                required
              />
            </div>
            <div className="ess-field">
              <label htmlFor="em-rel">Relationship *</label>
              <input
                id="em-rel"
                value={contacts.emergencyRelation}
                onChange={(e) => setField('emergencyRelation', e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="ess-btn ess-btn-primary"
              disabled={!dirty}
            >
              Save contacts
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
