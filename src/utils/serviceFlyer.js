// Shared "service QR" flyer — prints TWO identical labels on one standard US Letter
// (8.5" x 11") sheet, each sized to an 8.125" x 5" label (2-up: top half + bottom half).
// Printing a normal Letter page (rather than a custom page size the print dialog can't
// honor) is what keeps each flyer inside one label instead of straddling the seam.
// Left side: subscriber logo + business name + landlord-approval notice. Right side: QR.
// Used from Service Requests and the New Job form so both produce the identical page.

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export function printServiceFlyer({ qrUrl, orgName, orgLogoUrl, orgPhone, address } = {}) {
  if (!qrUrl) { alert('No QR link to print yet.'); return }
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=1200x1200&margin=0&data=${encodeURIComponent(qrUrl)}`

  const brandBlock = orgLogoUrl
    ? `<img class="logo" src="${esc(orgLogoUrl)}" alt="${esc(orgName || 'Business')} logo" />
       <div class="biz biz-sm">${esc(orgName || '')}</div>`
    : `<div class="biz biz-lg">${esc(orgName || '')}</div>`

  const addrBlock = address ? `<div class="addr">${esc(address)}</div>` : ''
  const phoneBlock = orgPhone
    ? `<div class="phone">Questions? Call us at <strong>${esc(orgPhone)}</strong></div>`
    : ''

  // One label's inner content (rendered twice — top and bottom of the sheet).
  const label = `
    <div class="label">
      <div class="left">
        ${brandBlock}
        <div class="headline">Need A/C or heating service?</div>
        <p class="sub">Point your phone's camera at the code to send us a service request.</p>
        <div class="notice">
          <div class="t">What happens next</div>
          <div class="b">We'll call you to schedule as soon as your landlord approves the request.</div>
        </div>
        <div class="foot">
          ${addrBlock}
          ${phoneBlock}
        </div>
      </div>
      <div class="right">
        <div class="qr-wrap"><img class="qr" src="${qrSrc}" alt="Service request QR code" /></div>
        <div class="scan">Scan to request service</div>
      </div>
    </div>`

  const w = window.open('', '_blank', 'width=850,height=1100')
  if (!w) { alert('Please allow pop-ups to print the QR flyer.'); return }

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Service QR</title>
<style>
  @page { size: 8.5in 11in; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; color: #0f172a;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  /* Full Letter sheet: 0.5in top & bottom, two 5in labels stacked flush in between. */
  .sheet { width: 8.5in; height: 11in; padding: 0.5in 0; margin: 0 auto; overflow: hidden; }
  .label { width: 8.125in; height: 5in; margin: 0 auto; padding: 0.3in 0.35in;
    display: flex; flex-direction: row; align-items: center; gap: 0.3in; break-inside: avoid; }
  .left { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; }
  .right { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; }
  .logo { max-height: 0.8in; max-width: 3.2in; object-fit: contain; margin-bottom: 6px; }
  .biz { font-weight: 800; letter-spacing: -0.01em; line-height: 1.08; }
  .biz-lg { font-size: 25px; margin-bottom: 2px; }
  .biz-sm { font-size: 15px; color: #334155; }
  .headline { font-size: 20px; font-weight: 800; margin: 11px 0 2px; }
  .sub { font-size: 13px; color: #475569; margin: 0; line-height: 1.35; }
  .notice { margin-top: 13px; background: #EEF4FF; border: 1px solid #C7D7FE; border-radius: 12px; padding: 10px 14px; }
  .notice .t { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: #1E40AF; margin-bottom: 3px; }
  .notice .b { font-size: 13.5px; color: #1e293b; line-height: 1.38; }
  .foot { margin-top: 11px; }
  .addr { font-size: 12px; color: #64748b; margin-bottom: 3px; }
  .phone { font-size: 13px; color: #0f172a; }
  .qr-wrap { border: 2px solid #0f172a; border-radius: 14px; padding: 11px; background: #fff; }
  .qr { width: 2.8in; height: 2.8in; display: block; }
  .scan { font-size: 11px; color: #475569; margin-top: 6px; text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
</style></head>
<body onload="setTimeout(function(){window.focus();window.print()},350)">
  <div class="sheet">
    ${label}
    ${label}
  </div>
</body></html>`)
  w.document.close()
}
