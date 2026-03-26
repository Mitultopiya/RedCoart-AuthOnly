import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'vth_rate_calculator_preview';

export default function RateCalculatorPreview() {
  const navigate = useNavigate();
  const location = useLocation();
  const isStaffRoute = location.pathname.startsWith('/staff/');
  const calculatorBase = isStaffRoute ? '/staff/rate-calculator' : '/admin/rate-calculator';
  const handleEdit = () => navigate(`${calculatorBase}?edit=1`);

  const previewText = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem(STORAGE_KEY) || '';
  }, []);

  const handleCopy = async () => {
    if (!previewText) return;
    try {
      await navigator.clipboard.writeText(previewText);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadPdf = () => {
    if (!previewText) return;
    const escapeHtml = (value) => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = previewText.split('\n');
    const parts = [];
    let inList = false;
    let inCard = false;

    const closeList = () => {
      if (inList) {
        parts.push('</ul>');
        inList = false;
      }
    };
    const closeCard = () => {
      closeList();
      if (inCard) {
        parts.push('</section>');
        inCard = false;
      }
    };
    const cardClassFor = (title) => {
      const t = String(title || '').toLowerCase();
      if (t.includes('price summary')) return 'section-card summary-card';
      if (t.includes('trip details')) return 'section-card trip-card';
      if (t.includes('passenger details')) return 'section-card passenger-card';
      return 'section-card';
    };
    const openCard = (title) => {
      closeCard();
      parts.push(`<section class="${cardClassFor(title)}"><h2 class="section-title">${title}</h2>`);
      inCard = true;
    };

    for (let i = 0; i < lines.length; i += 1) {
      const raw = lines[i];
      const line = escapeHtml(raw);
      const trimmed = line.trim();
      if (!trimmed) {
        closeList();
        continue;
      }
      if (/^=+$/.test(trimmed)) continue;

      if (trimmed.includes('PRICE SUMMARY:')) {
        openCard('Price Summary');
        continue;
      }

      if (/^[^\-].*:$/.test(trimmed)) {
        openCard(trimmed.replace(/:$/, ''));
        continue;
      }

      if (trimmed.startsWith('- ')) {
        const content = trimmed.slice(2);
        const isGrandTotal = content.toUpperCase().includes('GRAND TOTAL');
        if (isGrandTotal) {
          closeCard();
          parts.push(`<div class="grand-total-wrap"><div class="grand-total-line">${content}</div></div>`);
          continue;
        }
        if (/^note\s*:/i.test(content)) {
          if (!inCard) openCard('Trip Details');
          closeList();
          const noteParts = [content.replace(/^note\s*:/i, '').trim()];
          while (i + 1 < lines.length) {
            const nextRaw = lines[i + 1];
            const nextTrimmed = String(nextRaw || '').trim();
            if (!nextTrimmed) break;
            if (nextTrimmed.startsWith('- ')) break;
            if (/^[^\-].*:$/.test(nextTrimmed)) break;
            if (/^=+$/.test(nextTrimmed)) break;
            noteParts.push(escapeHtml(nextRaw));
            i += 1;
          }
          const noteText = noteParts.join('\n').trim();
          parts.push(
            `<div class="note-box">` +
              `<div class="note-label">Itinerary Note</div>` +
              `<div class="note-text">${noteText || '-'}</div>` +
            `</div>`
          );
          continue;
        }
        if (!inCard) openCard('Details');
        if (!inList) {
          parts.push('<ul class="list">');
          inList = true;
        }
        parts.push(`<li>${content}</li>`);
        continue;
      }

      if (!inCard) openCard('Details');
      closeList();
      const isMoneyLine = line.includes('Rs.');
      parts.push(`<p class="line${isMoneyLine ? ' money-line' : ''}">${line}</p>`);
    }

    closeCard();
    const renderedHtml = parts.join('');

    const html = `
      <html>
        <head>
          <title>Package Info</title>
          <style>
            @page { size: A4; margin: 10mm; }
            * { box-sizing: border-box; }
            body {
              font-family: "Segoe UI", "Trebuchet MS", Arial, sans-serif;
              margin: 0;
              color: #1f2937;
              background: radial-gradient(circle at top, #eef9f7 0%, #f8fafc 55%, #ffffff 100%);
            }
            .sheet {
              width: 100%;
              max-width: 820px;
              margin: 0 auto;
              border: 1px solid #c9ddd8;
              border-radius: 16px;
              overflow: hidden;
              background: #fff;
              box-shadow: 0 12px 35px rgba(15, 118, 110, 0.12);
            }
            .header {
              padding: 18px 20px;
              color: #ffffff;
              background:
                linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0)),
                linear-gradient(90deg, #0f766e, #0ea5a4, #0284c7);
              border-bottom: 2px solid #0f766e;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              gap: 12px;
            }
            .title {
              margin: 0;
              font-size: 30px;
              letter-spacing: 0.03em;
              line-height: 1.1;
              font-weight: 800;
              text-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
            }
            .subtitle {
              margin-top: 6px;
              font-size: 13px;
              opacity: 0.95;
              letter-spacing: 0.04em;
            }
            .meta {
              font-size: 11px;
              text-align: right;
              opacity: 0.95;
              padding: 6px 10px;
              border: 1px solid rgba(255,255,255,0.35);
              border-radius: 8px;
              background: rgba(255,255,255,0.12);
            }
            .content {
              padding: 16px 18px 20px;
              background:
                linear-gradient(180deg, rgba(15, 118, 110, 0.04), rgba(15,118,110,0)),
                #ffffff;
            }
            .section-card {
              margin: 10px 0;
              padding: 10px 12px 8px;
              border: 1px solid #d6e6e2;
              border-radius: 12px;
              background: linear-gradient(180deg, #ffffff, #f9fcfc);
              box-shadow: 0 2px 10px rgba(15, 118, 110, 0.06);
            }
            .trip-card, .passenger-card {
              background: linear-gradient(180deg, #ffffff, #f2fbfa);
            }
            .summary-card {
              border-color: #bfe4dc;
              border-left: 4px solid #0f766e;
              background: linear-gradient(180deg, #f0fdfa, #f8fafc);
            }
            .section-title {
              margin: 0 0 8px;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              font-weight: 800;
              color: #0b5e58;
              display: inline-block;
              padding: 5px 12px;
              border-radius: 999px;
              background: linear-gradient(90deg, #d8f3ee, #ecfeff);
              border: 1px solid #b9e7df;
            }
            .line {
              margin: 0 0 7px;
              font-size: 12.5px;
              line-height: 1.5;
              padding-left: 2px;
            }
            .money-line {
              font-weight: 700;
              color: #0b5e58;
            }
            .list {
              margin: 0 0 10px 18px;
              padding: 0;
            }
            .list li {
              margin: 0 0 6px;
              font-size: 12.5px;
              line-height: 1.45;
            }
            .note-box {
              margin: 6px 0 10px;
              border: 1px solid #b9e7df;
              border-left: 4px solid #0f766e;
              border-radius: 10px;
              padding: 8px 10px;
              background: linear-gradient(180deg, #f0fdfa, #f8fafc);
            }
            .note-label {
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              font-weight: 800;
              color: #0b5e58;
              margin-bottom: 4px;
            }
            .note-text {
              font-size: 12.5px;
              line-height: 1.45;
              color: #1f2937;
              white-space: pre-wrap;
              overflow-wrap: anywhere;
              word-break: break-word;
            }
            .spacer { height: 4px; }
            .grand-total-wrap { margin-top: 10px; width: 100%; }
            .grand-total-line {
              width: 100%;
              padding: 12px 14px;
              border-radius: 10px;
              color: #ffffff;
              font-size: 14px;
              font-weight: 800;
              letter-spacing: 0.02em;
              background: linear-gradient(90deg, #0b5e58, #0f766e, #0ea5a4);
              box-shadow: 0 8px 20px rgba(15, 118, 110, 0.25);
              line-height: 1.35;
              white-space: normal;
              overflow-wrap: anywhere;
              word-break: break-word;
            }
            .footer-note {
              margin-top: 12px;
              font-size: 10px;
              color: #6b7280;
              text-align: center;
              border-top: 1px dashed #d1d5db;
              padding-top: 8px;
            }
            @media print {
              body { background: #fff; }
              .sheet {
                max-width: none;
                border-radius: 0;
                box-shadow: none;
                border: 1px solid #d1d5db;
              }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">
              <div>
                <h1 class="title">Package Info</h1>
                <div class="subtitle">Vision Travel Hub</div>
              </div>
              <div class="meta">Generated: ${new Date().toLocaleString('en-IN')}</div>
            </div>
            <div class="content">
              ${renderedHtml}
              <div class="footer-note">Prepared by Vision Travel Hub • Tailored itinerary & pricing document</div>
            </div>
          </div>
        </body>
      </html>
    `;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => {
      w.focus();
      w.print();
    }, 300);
  };

  if (!previewText) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Package Info</h1>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-slate-500">
          No preview data found. Please calculate trip cost first.
        </div>
        <button
          type="button"
          onClick={() => navigate(calculatorBase)}
          className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
        >
          Back to Rate Calculator
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Package Info</h1>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <textarea
          value={previewText}
          readOnly
          rows={20}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"
        />
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            type="button"
            onClick={handleEdit}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            Copy To Clipboard
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="px-3 py-2 rounded-lg bg-pink-600 text-white text-sm font-medium hover:bg-pink-700"
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
