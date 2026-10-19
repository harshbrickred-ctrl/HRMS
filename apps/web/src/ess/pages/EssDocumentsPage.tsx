import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { downloadEssDocument, useEssData } from '../mock/EssDataContext';
import type { EssDocument } from '../mock/essMock';

const DOCUMENT_GROUPS = [
  'Brickred Documents',
  'Educational Certificates',
  'Employee Documents',
  'Past Employment Documents',
] as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function lastUpdatedLabel(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return `Last updated on ${day} ${MONTHS[month - 1]}, ${year}`;
}

function DocumentRows({ docs }: { docs: EssDocument[] }) {
  return (
    <ul className="ess-doc-rows">
      {docs.map((doc) => (
        <li key={doc.id}>
          <button
            type="button"
            className="ess-doc-row"
            aria-label={`Download ${doc.name}`}
            onClick={() => downloadEssDocument(doc)}
          >
            <ChevronRight size={16} aria-hidden />
            <span className="ess-doc-row-name">{doc.name}</span>
            <span className="ess-doc-row-date">{lastUpdatedLabel(doc.uploadedAt)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DocumentGroups({
  rows,
  filtersOn,
}: {
  rows: EssDocument[];
  filtersOn: boolean;
}) {
  const known = new Set<string>(DOCUMENT_GROUPS);
  const groups = DOCUMENT_GROUPS.map((name) => ({
    name,
    docs: rows.filter((doc) => doc.category === name),
  })).filter((group) => group.docs.length > 0);
  const extraNames = [...new Set(rows.map((doc) => doc.category))].filter(
    (name) => !known.has(name),
  );
  const extras = extraNames.map((name) => ({
    name,
    docs: rows.filter((doc) => doc.category === name),
  }));
  const visible = [...groups, ...extras];

  if (visible.length === 0) {
    return (
      <p className="ess-empty">
        {filtersOn
          ? 'Nothing matches these filters. Clear them or switch lists.'
          : 'No documents in this list. HR adds employee files.'}
      </p>
    );
  }

  return (
    <>
      {visible.map((group) => (
        <section key={group.name} className="ess-panel ess-doc-group">
          <h2>{group.name}</h2>
          <DocumentRows docs={group.docs} />
        </section>
      ))}
    </>
  );
}

export function EssDocumentsPage() {
  const { documents } = useEssData();
  const [list, setList] = useState<'mine' | 'policies'>('mine');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const owned = useMemo(
    () =>
      documents.filter((doc) =>
        list === 'policies' ? doc.owner === 'company' : doc.owner === 'mine' && doc.remote,
      ),
    [documents, list],
  );
  const categories = useMemo(
    () => [...new Set(owned.map((doc) => doc.category))].sort(),
    [owned],
  );
  const filtersOn = Boolean(category || from || to);
  const rows = useMemo(() => {
    return owned.filter((doc) => {
      if (category && doc.category !== category) return false;
      if (from && doc.uploadedAt < from) return false;
      if (to && doc.uploadedAt > to) return false;
      return true;
    });
  }, [owned, category, from, to]);

  function clearFilters() {
    setCategory('');
    setFrom('');
    setTo('');
  }

  return (
    <div className="ess-section-stack">
      <p className="ess-page-lead">
        HR keeps your employee files here. Company policies stay available to everyone.
      </p>

      <section className="ess-panel">
        <div className="ess-att-toolbar">
          <h2>{list === 'mine' ? 'My documents' : 'Policies'}</h2>
          <div className="ess-tabs" role="tablist" aria-label="Document lists">
            <button
              type="button"
              role="tab"
              aria-selected={list === 'mine'}
              className={list === 'mine' ? 'ess-tab is-active' : 'ess-tab'}
              onClick={() => setList('mine')}
            >
              Mine
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={list === 'policies'}
              className={list === 'policies' ? 'ess-tab is-active' : 'ess-tab'}
              onClick={() => setList('policies')}
            >
              Policies
            </button>
          </div>
        </div>

        <div className="ess-filters">
          <label className="ess-filter-field">
            <span>Category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="ess-filter-field">
            <span>From</span>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="ess-filter-field">
            <span>To</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          {filtersOn ? (
            <button type="button" className="ess-btn" onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      {list === 'policies' ? (
        <section className="ess-panel">
          {rows.length === 0 ? (
            <p className="ess-empty">
              {filtersOn
                ? 'Nothing matches these filters. Clear them or switch lists.'
                : 'No documents in this list.'}
            </p>
          ) : (
            <DocumentRows docs={rows} />
          )}
        </section>
      ) : (
        <DocumentGroups rows={rows} filtersOn={filtersOn} />
      )}
    </div>
  );
}
