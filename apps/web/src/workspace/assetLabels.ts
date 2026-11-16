import type { AssetRecord } from './assetsApi';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** Opens a print-ready sheet of labels, one per asset, in a new tab. False when pop-ups are blocked. */
export function printAssetLabels(assets: Array<Pick<AssetRecord, 'assetTag' | 'name' | 'serialNo' | 'category' | 'location'>>) {
  const win = window.open('', '_blank');
  if (!win) return false;
  const labels = assets
    .map(
      (asset) =>
        `<div class="label"><strong>${escapeHtml(asset.assetTag)}</strong><span>${escapeHtml(asset.name)}</span>${
          asset.serialNo ? `<span>S/N ${escapeHtml(asset.serialNo)}</span>` : ''
        }<span>${escapeHtml(asset.category.name)}${asset.location ? ` · ${escapeHtml(asset.location.name)}` : ''}</span></div>`,
    )
    .join('');
  win.document.write(`<!DOCTYPE html><html><head><title>Asset labels</title><style>
    body{font-family:system-ui,sans-serif;margin:12mm}
    .sheet{display:grid;grid-template-columns:repeat(3,62mm);gap:4mm}
    .label{border:1px dashed #888;border-radius:2mm;padding:3mm;display:grid;gap:1mm;font-size:9pt;break-inside:avoid}
    .label strong{font:700 14pt ui-monospace,monospace;letter-spacing:.04em}
  </style></head><body><div class="sheet">${labels}</div><script>window.onload=function(){window.print()}</script></body></html>`);
  win.document.close();
  return true;
}
