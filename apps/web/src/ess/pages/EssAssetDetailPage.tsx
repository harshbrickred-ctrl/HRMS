import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EssModal } from '../components/EssModal';
import { StatusChip } from '../components/StatusChip';
import {
  ACK_LABELS,
  ASSET_STATUS_LABELS,
  acknowledgeAsset,
  assetMessage,
  fetchMyAsset,
  fetchMyAssetPhoto,
  titleCase,
  uploadMySignedForm,
  type MyAssetDetail,
} from '../../workspace/assetsApi';

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}

export function EssAssetDetailPage() {
  const { id = '' } = useParams();
  const [asset, setAsset] = useState<MyAssetDetail | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyAsset(id)
      .then(setAsset)
      .catch((err: unknown) => setError(assetMessage(err)));
  }, [id]);

  const hasPhoto = asset?.hasPhoto ?? false;
  useEffect(() => {
    if (!hasPhoto) return;
    let url: string | null = null;
    let live = true;
    fetchMyAssetPhoto(id)
      .then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setPhotoUrl(url);
      })
      .catch(() => undefined);
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, hasPhoto]);

  async function onAcknowledge() {
    setBusy(true);
    setError(null);
    try {
      setAsset(await acknowledgeAsset(id));
      setConfirming(false);
    } catch (err: unknown) {
      setConfirming(false);
      setError(assetMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onForm(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadMySignedForm(id, file);
      setAsset(await fetchMyAsset(id));
    } catch (err: unknown) {
      setError(assetMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ess-section-stack ess-assets">
      <Link className="ess-btn ess-btn-ghost it-assets-back" to="/ess/assets">
        ← My assets
      </Link>
      {error ? <p className="ess-alert">{error}</p> : null}
      {!asset ? (
        error ? null : (
          <p className="ess-empty">Loading…</p>
        )
      ) : (
        <>
          <section className="ess-panel">
            <div className="ess-panel-head">
              <h2>
                {asset.assetTag} · {asset.name}
              </h2>
              <StatusChip status={asset.status} label={ASSET_STATUS_LABELS[asset.status]} />
            </div>
            <div className="it-assets-detail">
              <dl className="it-assets-facts">
                <Fact label="Category" value={asset.category} />
                <Fact label="Make and model" value={`${asset.make} ${asset.model}`.trim()} />
                <Fact label="Serial number" value={asset.serialNo} />
                <Fact label="Purchase date" value={asset.purchasedOn} />
                <Fact label="Issue date" value={asset.assignedOn} />
                <Fact label="Issued condition" value={asset.issueCondition ? titleCase(asset.issueCondition) : ''} />
                <Fact label="Accessories" value={asset.accessories} />
                <Fact label="Acknowledgement" value={ACK_LABELS[asset.ackStatus]} />
                {asset.ackAt ? <Fact label="Acknowledged on" value={asset.ackAt.slice(0, 10)} /> : null}
              </dl>
              {photoUrl ? (
                <div className="it-assets-photo">
                  <img src={photoUrl} alt={asset.name} />
                </div>
              ) : null}
            </div>
          </section>

          {asset.status === 'allocated' ? (
            <section className="ess-panel">
              <div className="ess-actions">
                {asset.ackStatus === 'pending' ? (
                  <>
                    <button type="button" className="ess-btn ess-btn-primary" onClick={() => setConfirming(true)}>
                      Acknowledge receipt
                    </button>
                    <label className="ess-btn">
                      Upload signed form
                      <input
                        type="file"
                        accept=".pdf,image/png,image/jpeg,image/webp"
                        hidden
                        onChange={(event) => void onForm(event.target.files?.[0])}
                      />
                    </label>
                  </>
                ) : null}
                <Link className="ess-btn" to={`/ess/assets/${id}/fault`}>
                  Report a fault
                </Link>
                <Link className="ess-btn ess-btn-danger" to={`/ess/assets/${id}/lost`}>
                  Report lost or stolen
                </Link>
              </div>
            </section>
          ) : null}

          {confirming ? (
            <EssModal
              title={`Acknowledge ${asset.assetTag}`}
              onClose={() => setConfirming(false)}
              actions={
                <>
                  <button type="button" className="ess-btn" onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                  <button type="button" className="ess-btn ess-btn-primary" disabled={busy} onClick={() => void onAcknowledge()}>
                    {busy ? 'Saving…' : 'I received this asset'}
                  </button>
                </>
              }
            >
              <dl className="it-assets-facts">
                <Fact label="Asset" value={asset.name} />
                <Fact label="Issue date" value={asset.assignedOn} />
                <Fact label="Condition" value={asset.issueCondition ? titleCase(asset.issueCondition) : ''} />
                <Fact label="Accessories" value={asset.accessories} />
              </dl>
              <p className="ess-muted">This is recorded against your name and can't be changed afterwards.</p>
            </EssModal>
          ) : null}
        </>
      )}
    </div>
  );
}
