// Rewards-HVAC · lightweight i18n for the employee-facing portal (EN/ES).
// Spanish support is a top adoption driver for field crews.
const DICT = {
  en: {
    title: 'My Pay & Benefits', back: 'Back',
    tab_pay: 'Pay Stubs', tab_pto: 'Time Off', tab_w2: 'W-2',
    pay_week: 'Pay week', gross: 'Gross', taxes: 'Taxes', net: 'Net', stub: 'Stub',
    no_pay: 'No pay records yet.', no_pto: 'No time-off balances.', hrs: 'hrs',
    tax_year: 'Tax year', no_w2: 'No W-2 data for',
    box1: 'Box 1 — Wages', box2: 'Box 2 — Federal income tax', box3: 'Box 3 — Social Security wages',
    box4: 'Box 4 — Social Security tax', box5: 'Box 5 — Medicare wages', box6: 'Box 6 — Medicare tax',
    box12d: 'Box 12a — 401(k) (code D)', box17: 'Box 17 — State income tax',
    w2_note: 'Preliminary figures from your pay records. Your official W-2 is issued by year-end.',
    // stub
    pay_period: 'Pay period', gross_pay: 'Gross pay', fed_tax: 'Federal income tax',
    ss: 'Social Security', medicare: 'Medicare', state_tax: 'State income tax',
    deductions: 'Deductions', total_withheld: 'Total withheld', net_pay: 'Net pay',
  },
  es: {
    title: 'Mi Pago y Beneficios', back: 'Atrás',
    tab_pay: 'Talones de Pago', tab_pto: 'Tiempo Libre', tab_w2: 'W-2',
    pay_week: 'Semana de pago', gross: 'Bruto', taxes: 'Impuestos', net: 'Neto', stub: 'Talón',
    no_pay: 'Aún no hay registros de pago.', no_pto: 'Sin saldos de tiempo libre.', hrs: 'hrs',
    tax_year: 'Año fiscal', no_w2: 'Sin datos de W-2 para',
    box1: 'Casilla 1 — Salarios', box2: 'Casilla 2 — Impuesto federal', box3: 'Casilla 3 — Salarios del Seguro Social',
    box4: 'Casilla 4 — Impuesto del Seguro Social', box5: 'Casilla 5 — Salarios de Medicare', box6: 'Casilla 6 — Impuesto de Medicare',
    box12d: 'Casilla 12a — 401(k) (código D)', box17: 'Casilla 17 — Impuesto estatal',
    w2_note: 'Cifras preliminares de sus registros de pago. Su W-2 oficial se emite a fin de año.',
    pay_period: 'Período de pago', gross_pay: 'Pago bruto', fed_tax: 'Impuesto federal',
    ss: 'Seguro Social', medicare: 'Medicare', state_tax: 'Impuesto estatal',
    deductions: 'Deducciones', total_withheld: 'Total retenido', net_pay: 'Pago neto',
  },
}

export function getLang() {
  try { return localStorage.getItem('rewards_lang') === 'es' ? 'es' : 'en' } catch { return 'en' }
}
export function setLang(l) { try { localStorage.setItem('rewards_lang', l) } catch { /* ignore */ } }
export function makeT(lang) {
  const d = DICT[lang] || DICT.en
  return (key) => d[key] || DICT.en[key] || key
}
