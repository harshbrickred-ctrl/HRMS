import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { StatusChip } from '../ess/components/StatusChip';
import { ItAssetIssueTabs } from './ItAssetIssueTabs';
import {
  ISSUE_CONDITIONS,
  allocateAsset,
  assetMessage,
  fetchAssetPeople,
  fetchAssetRequests,
  fetchAssets,
  fetchEmployeeAllocations,
  fulfilAssetRequest,
  initials,
  rupees,
  todayIso,
  uploadSignedForm,
  type AssetPerson,
  type AssetRecord,
  type AssetRequestRow,
  type EmployeeAllocation,
} from './assetsApi';
import './it-assets.css';

/** Accessories usually handed over with each kind of asset; anything else goes in "Other". */
const ACCESSORY_PRESETS: Record<string, string[]> = {
  laptop: ['Charger', 'Bag', 'Mouse'],
  mobile: ['Charger', 'Case', 'Earphones'],
  monitor: ['Power cable', 'HDMI cable', 'Stand'],
  access_card: ['Lanyard'],
  id_card: ['Lanyard'],
};

const ACK_DAYS = [1, 2, 3, 5, 7, 10];
const EMPLOYMENT_TYPES = ['Permanent', 'Contract', 'Intern', 'Consultant'];

type Item = {
  asset: AssetRecord;
  condition: string;
  accessories: string[];
  other: string;
};

function newItem(asset: AssetRecord): Item {
  return { asset, condition: 'new', accessories: [], other: '' };
}

export function ItAssetAllocatePage() {
  const [params] = useSearchParams();
  const [people, setPeople] = useState<AssetPerson[]>([]);
  const [stock, setStock] = useState<AssetRecord[]>([]);
  const [approved, setApproved] = useState<AssetRequestRow[]>([]);
  const [find, setFind] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [held, setHeld] = useState<EmployeeAllocation[]>([]);
  const [scan, setScan] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [issuedOn, setIssuedOn] = useState(todayIso());
  const [expectedReturnOn, setExpectedReturnOn] = useState('');
  const [method, setMethod] = useState<'portal' | 'form'>('portal');
  const [form, setForm] = useState<File | null>(null);
  const [ackWithinDays, setAckWithinDays] = useState(3);
  const [notifyManager, setNotifyManager] = useState(true);
  const [note, setNote] = useState('');
  const [project, setProject] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function loadStock() {
    return fetchAssets({ status: 'in_stock' }).then(setStock);
  }

  useEffect(() => {
    Promise.all([fetchAssetPeople(), fetchAssets({ status: 'in_stock' }), fetchAssetRequests('approved')])
      .then(([staff, inStock, requests]) => {
        setPeople(staff.filter((person) => person.active));
        setStock(inStock);
        setApproved(requests);
        const preset = inStock.find((asset) => asset.id === params.get('assetId'));
        if (preset) setItems([newItem(preset)]);
        setReady(true);
      })
      .catch((err: unknown) => setError(assetMessage(err)));
  }, [params]);

  useEffect(() => {
    if (!employeeId) return;
    let live = true;
    fetchEmployeeAllocations(employeeId)
      .then((data) => {
        if (live) setHeld(data.current);
      })
      .catch((err: unknown) => {
        if (live) setError(assetMessage(err));
      });
    return () => {
      live = false;
    };
  }, [employeeId]);

  const employee = people.find((person) => person.id === employeeId) ?? null;
  const holdings = employee ? held.filter((row) => row.employee.id === employee.id) : [];
  const matches = useMemo(() => {
    const text = find.trim().toLowerCase();
    if (!text) return people.slice(0, 50);
    return people.filter((person) =>
      [person.name, person.employeeCode, person.department ?? ''].some((value) => value.toLowerCase().includes(text)),
    );
  }, [find, people]);
  const waiting = approved.filter((row) => row.employee.id === employeeId);
  const available = stock.filter((asset) => !items.some((item) => item.asset.id === asset.id));

  function add(asset: AssetRecord) {
    setItems((prev) => (prev.some((item) => item.asset.id === asset.id) ? prev : [...prev, newItem(asset)]));
  }

  function onScan(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const code = scan.trim().toUpperCase();
    if (!code) return;
    const asset = stock.find((row) => row.assetTag.toUpperCase() === code || row.serialNo?.toUpperCase() === code);
    if (!asset) {
      setError(`No in-stock asset has the tag or serial ${code}.`);
      return;
    }
    setError(null);
    add(asset);
    setScan('');
  }

  function update(assetId: string, change: Partial<Item>) {
    setItems((prev) => prev.map((item) => (item.asset.id === assetId ? { ...item, ...change } : item)));
  }

  // An approved request for the same category is fulfilled by this issue rather than left open.
  function requestFor(item: Item, used: Set<string>) {
    return waiting.find((row) => row.category.id === item.asset.category.id && !used.has(row.id)) ?? null;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!employee || !items.length) return;
    if (method === 'form' && !form) {
      setError('Attach the signed form, or choose e-sign in the employee portal.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const issued: string[] = [];
    const used = new Set<string>();
    try {
      for (const item of items) {
        const accessories = [...item.accessories, item.other.trim()].filter(Boolean).join(', ');
        const common = {
          issuedOn,
          expectedReturnOn: expectedReturnOn || undefined,
          condition: item.condition,
          accessories,
          notes: note,
          ackWithinDays: method === 'portal' ? ackWithinDays : undefined,
          notifyManager,
          project,
          contactMobile,
          employmentType,
        };
        const request = requestFor(item, used);
        if (request) used.add(request.id);
        const result = request
          ? await fulfilAssetRequest(request.id, { ...common, assetId: item.asset.id })
          : await allocateAsset(item.asset.id, { ...common, employeeId: employee.id });
        if (method === 'form' && form && result.current) {
          await uploadSignedForm(result.current.allocationId, 'signed_ack', form);
        }
        issued.push(`${item.asset.assetTag}${request ? ` (${request.reference})` : ''}`);
      }
      setNotice(
        `Issued ${issued.join(', ')} to ${employee.name}. ${
          method === 'portal' ? `They have been asked to accept within ${ackWithinDays} working days.` : 'The signed form is on file.'
        }`,
      );
      setItems([]);
      setForm(null);
      setNote('');
      const [requests] = await Promise.all([fetchAssetRequests('approved'), loadStock()]);
      setApproved(requests);
      setHeld((await fetchEmployeeAllocations(employee.id)).current);
    } catch (err: unknown) {
      setError(
        `${issued.length ? `Issued ${issued.join(', ')}. ` : ''}Stopped at the next asset: ${assetMessage(err)}`,
      );
      setItems((prev) => prev.filter((item) => !issued.some((tag) => tag.startsWith(item.asset.assetTag))));
      void loadStock();
    } finally {
      setBusy(false);
    }
  }

  const places = [...new Set(items.map((item) => item.asset.location?.name).filter(Boolean))];
  const bookValue = items.reduce((sum, item) => sum + (item.asset.bookValue ?? 0), 0);
  const steps = [
    { label: 'Choose the employee', done: !!employee },
    { label: 'Scan or pick assets', done: items.length > 0 },
    { label: 'Confirm and request acknowledgement', done: false },
  ];

  return (
    <div className="it-assets">
      <ItAssetIssueTabs />
      <ol className="it-steps">
        {steps.map((step, index) => (
          <li key={step.label} className={step.done ? 'is-done' : undefined}>
            <span className="it-step-no">{index + 1}</span>
            {step.label}
          </li>
        ))}
      </ol>
      {error ? <p className="ess-alert">{error}</p> : null}
      {notice ? <p className="it-assets-ok">{notice}</p> : null}
      {!ready ? (
        <p className="ess-empty">{error ? 'Could not load this page.' : 'Loading…'}</p>
      ) : (
        <form className="it-stack" onSubmit={(event) => void onSubmit(event)}>
          <div className="it-grid-2">
            <section className="ess-panel it-assets-form">
              <h2>1. Employee</h2>
              <div className="ess-field">
                <label htmlFor="issue-find">Find employee</label>
                <input
                  id="issue-find"
                  type="search"
                  value={find}
                  onChange={(event) => setFind(event.target.value)}
                  placeholder="Name, employee code or department"
                />
              </div>
              <div className="ess-field">
                <label htmlFor="issue-employee">Employee</label>
                <select id="issue-employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required>
                  <option value="">{matches.length ? 'Choose an employee' : 'Nobody matches'}</option>
                  {matches.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name} · {person.employeeCode}
                      {person.department ? ` · ${person.department}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {employee ? (
                <>
                  <div className="it-person">
                    <span className="it-avatar" aria-hidden>
                      {initials(employee.name)}
                    </span>
                    <div>
                      <strong>
                        {employee.name} · {employee.employeeCode}
                      </strong>
                      <span className="it-sub">{employee.department ?? 'No department'}</span>
                    </div>
                  </div>
                  <div>
                    <p className="ess-muted">Already holds</p>
                    {holdings.length === 0 ? <p className="ess-empty">Nothing yet.</p> : null}
                    <ul className="it-activity">
                      {holdings.map((row) => (
                        <li key={row.id}>
                          <span>
                            {row.asset.name}{' '}
                            <Link to={`/it/assets/${row.asset.id}`} className="it-sub" style={{ display: 'inline' }}>
                              {row.asset.assetTag}
                            </Link>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {waiting.length ? (
                    <div>
                      <p className="ess-muted">Approved requests waiting to be issued</p>
                      <ul className="it-activity">
                        {waiting.map((row) => (
                          <li key={row.id}>
                            <span>
                              {row.category.name} <span className="it-sub" style={{ display: 'inline' }}>{row.reference}</span>
                            </span>
                            <span className="it-sub">Issuing a {row.category.name} here fulfils this request.</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>

            <section className="ess-panel it-assets-form">
              <h2>2. Assets to issue</h2>
              <div className="ess-field">
                <label htmlFor="issue-scan">Scan a barcode label or type an asset tag</label>
                <input
                  id="issue-scan"
                  value={scan}
                  onChange={(event) => setScan(event.target.value)}
                  onKeyDown={onScan}
                  placeholder="e.g. LAP-0004, then Enter"
                  autoComplete="off"
                />
              </div>
              <div className="ess-field">
                <label htmlFor="issue-pick">Or pick from stock</label>
                <select
                  id="issue-pick"
                  value=""
                  onChange={(event) => {
                    const asset = stock.find((row) => row.id === event.target.value);
                    if (asset) add(asset);
                  }}
                >
                  <option value="">{available.length ? `Choose from ${available.length} in stock` : 'Nothing else in stock'}</option>
                  {available.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.assetTag} · {asset.name}
                      {asset.location ? ` · ${asset.location.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {items.length === 0 ? <p className="ess-empty">No assets added yet.</p> : null}
              <ul className="it-pick-list">
                {items.map((item) => {
                  const presets = ACCESSORY_PRESETS[item.asset.category.code] ?? [];
                  return (
                    <li key={item.asset.id} className="it-pick">
                      <div className="it-pick-head">
                        <div>
                          <strong>{item.asset.name}</strong>
                          <span className="it-sub">
                            {item.asset.assetTag}
                            {item.asset.serialNo ? ` · Serial ${item.asset.serialNo}` : ''}
                            {item.asset.location ? ` · ${item.asset.location.name}` : ''}
                          </span>
                        </div>
                        <div className="ess-actions">
                          <StatusChip status="in_stock" label="In stock" />
                          <button
                            type="button"
                            className="ess-btn ess-btn-ghost"
                            onClick={() => setItems((prev) => prev.filter((row) => row.asset.id !== item.asset.id))}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="it-assets-fields">
                        <label className="it-label">
                          Condition at issue
                          <select value={item.condition} onChange={(event) => update(item.asset.id, { condition: event.target.value })}>
                            {ISSUE_CONDITIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="it-label">
                          Other accessories
                          <input
                            value={item.other}
                            onChange={(event) => update(item.asset.id, { other: event.target.value })}
                            maxLength={200}
                            placeholder="Anything else handed over"
                          />
                        </label>
                      </div>
                      {presets.length ? (
                        <div className="it-checks" role="group" aria-label="Accessories handed over">
                          {presets.map((name) => (
                            <label key={name}>
                              <input
                                type="checkbox"
                                checked={item.accessories.includes(name)}
                                onChange={(event) =>
                                  update(item.asset.id, {
                                    accessories: event.target.checked
                                      ? [...item.accessories, name]
                                      : item.accessories.filter((value) => value !== name),
                                  })
                                }
                              />
                              {name}
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <section className="ess-panel it-assets-form">
            <h2>3. Acknowledgement</h2>
            <div className="it-assets-fields">
              <div className="it-radio-list" role="radiogroup" aria-label="How the employee accepts">
                <span className="ess-muted">How the employee accepts</span>
                <label>
                  <input type="radio" name="ack" checked={method === 'portal'} onChange={() => setMethod('portal')} />
                  E-sign in the employee portal (default)
                </label>
                <label>
                  <input type="radio" name="ack" checked={method === 'form'} onChange={() => setMethod('form')} />
                  Collect a signed form in person and upload it
                </label>
              </div>
              {method === 'portal' ? (
                <label className="it-label">
                  Employee must accept within
                  <select value={ackWithinDays} onChange={(event) => setAckWithinDays(Number(event.target.value))}>
                    {ACK_DAYS.map((value) => (
                      <option key={value} value={value}>
                        {value} working day{value === 1 ? '' : 's'}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="it-label">
                  Signed form (PDF or photo)
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    onChange={(event) => setForm(event.target.files?.[0] ?? null)}
                  />
                </label>
              )}
              <label className="it-label">
                Issue date
                <input type="date" max={todayIso()} value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} required />
              </label>
              <label className="it-label">
                Expected return (optional)
                <input type="date" min={issuedOn} value={expectedReturnOn} onChange={(event) => setExpectedReturnOn(event.target.value)} />
              </label>
              <label className="it-label">
                Project / work details (optional)
                <input value={project} onChange={(event) => setProject(event.target.value)} maxLength={300} />
              </label>
              <label className="it-label">
                Mobile no (optional)
                <input type="tel" value={contactMobile} onChange={(event) => setContactMobile(event.target.value)} maxLength={30} />
              </label>
              <label className="it-label">
                Employment type (optional)
                <input
                  list="issue-employment-types"
                  value={employmentType}
                  onChange={(event) => setEmploymentType(event.target.value)}
                  maxLength={60}
                />
                <datalist id="issue-employment-types">
                  {EMPLOYMENT_TYPES.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              </label>
            </div>
            <div className="it-checks">
              <label>
                <input type="checkbox" checked={notifyManager} onChange={(event) => setNotifyManager(event.target.checked)} />
                Tell the reporting manager
              </label>
            </div>
            <div className="ess-field">
              <label htmlFor="issue-note">Note for the receiver</label>
              <textarea id="issue-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} />
            </div>
          </section>

          <section className="ess-panel it-summary">
            <dl>
              <div>
                <dt className="ess-muted">Items</dt>
                <dd>{items.length}</dd>
              </div>
              <div>
                <dt className="ess-muted">Issued from</dt>
                <dd>{places.length ? places.join(', ') : '—'}</dd>
              </div>
              <div>
                <dt className="ess-muted">Book value</dt>
                <dd>{rupees(bookValue)}</dd>
              </div>
            </dl>
            <div className="ess-actions">
              <Link className="ess-btn" to="/it/assets">
                Cancel
              </Link>
              <button type="submit" className="ess-btn ess-btn-primary" disabled={busy || !employee || !items.length}>
                {busy ? 'Issuing…' : 'Issue and request acknowledgement'}
              </button>
            </div>
          </section>
        </form>
      )}
    </div>
  );
}
