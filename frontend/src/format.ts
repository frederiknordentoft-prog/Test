/** Danish number formatting + the label dictionary.
 *
 * Every number on screen carries a unit ("1,2 mia. kr.", "84 %", "412.000
 * kunder") — naked numbers were the single biggest credibility hit in the
 * design review. One formatter, used by KPIs, chart axes, tooltips and tables.
 */

const nf0 = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 });

export type Unit = "mio_kr" | "pct" | "antal" | "index" | "x" | "raw";

/** Format a value with its unit, Danish locale. `mio_kr` expects mio. DKK and
 *  upgrades to "mia. kr." at 1000. */
export function formatDa(v: number | null | undefined, unit: Unit = "raw"): string {
  if (v == null || Number.isNaN(v)) return "—";
  switch (unit) {
    case "mio_kr":
      return Math.abs(v) >= 1000
        ? `${nf1.format(v / 1000)} mia. kr.`
        : `${nf0.format(v)} mio. kr.`;
    case "pct":
      return `${nf1.format(v * 100)} %`;
    case "antal":
      return nf0.format(v);
    case "index":
      return nf1.format(v);
    case "x":
      return `${nf2.format(v)}×`;
    default:
      return Math.abs(v) >= 1000 ? nf0.format(v) : nf2.format(v);
  }
}

/** Short axis-tick variant (no unit suffix — the card title carries it). */
export function axisDa(v: number, unit: Unit = "raw"): string {
  if (v == null || Number.isNaN(v)) return "";
  switch (unit) {
    case "mio_kr":
      return Math.abs(v) >= 1000 ? `${nf1.format(v / 1000)} mia.` : nf0.format(v);
    case "pct":
      return `${nf0.format(v * 100)} %`;
    case "antal":
      return Math.abs(v) >= 1_000_000
        ? `${nf1.format(v / 1_000_000)} mio.`
        : nf0.format(v);
    case "x":
      return nf2.format(v);
    default:
      return Math.abs(v) >= 1000 ? nf0.format(v) : nf2.format(v);
  }
}

/* ------------------------------------------------------------------------ */
/* Label dictionary: internal ids never leak raw into the UI.                */

export const EVENT_LABELS: Record<string, { name: string; desc: string }> = {
  spilpakke_1: {
    name: "Spilpakke 1",
    desc: "Reklameforbud (fløjt-til-fløjt), bonus-/affiliate-restriktioner og tabsgrænser. Styrke 1,0 = fuld pakke.",
  },
  spilpakke_2: {
    name: "Spilpakke 2",
    desc: "Målrettet prediction markets/Stake: lukker fintech-smuthullet + håndhævelse.",
  },
  prediction_surge: {
    name: "Prediction-smuthullet åbner",
    desc: "Prediction markets ankommer via finans-apps — kan ikke DNS-blokeres.",
  },
  ad_ban: {
    name: "Reklameforbud",
    desc: "Slukker licenserede operatørers marketing. Styrke 1,0 = fuldt forbud.",
  },
  tax_change: {
    name: "Afgiftsændring",
    desc: "Ekstra spilafgift, delvist væltet over i dårligere odds. Styrke 1,0 ≈ +5 pp.",
  },
  enforcement_boost: {
    name: "Håndhævelses-boost",
    desc: "DNS-/betalingsblokering af offshore (effekten henfalder — spejlsider).",
  },
  rg_2_0: {
    name: "RG 2.0 (AI-skadedetektion)",
    desc: "Proaktiv AI-baseret ansvarligt spil-detektion. Sænker skade, øger ROFUS-tilgang.",
  },
  crash_games_licensed: {
    name: "Crash games legaliseres",
    desc: "Forbudte produkter tillades under licens — trækker kanalisering op.",
  },
  liberalize: {
    name: "Monopol liberaliseres",
    desc: "Lotteri/skrab åbnes for konkurrence (monopol-scope ned).",
  },
  ai_breakthrough: {
    name: "AI-gennembrud",
    desc: "Vildt AI-spring: frontier hopper. Styrke 1,0 ≈ +0,3 på fronten.",
  },
  offshore_surge: {
    name: "Offshore-bølge",
    desc: "Crypto-casinoer m.m. bliver mere tilgængelige (håndhævelse svækkes).",
  },
};

export const METRIC_LABELS: Record<string, { name: string; unit: Unit }> = {
  // headline
  market_size_total: { name: "Markedsstørrelse (inkl. offshore)", unit: "mio_kr" },
  bsi_total: { name: "Licenseret BSI", unit: "mio_kr" },
  ds_share_total: { name: "DS markedsandel", unit: "pct" },
  ds_share_liberalized: { name: "DS andel, liberaliseret marked", unit: "pct" },
  customers_total: { name: "Kunder (unikke)", unit: "antal" },
  customers_lottery: { name: "Kunder, lotteri", unit: "antal" },
  customers_scratch: { name: "Kunder, skrab", unit: "antal" },
  customers_casino: { name: "Kunder, casino", unit: "antal" },
  customers_sports: { name: "Kunder, sport", unit: "antal" },
  n_licensees: { name: "Licenserede udbydere (repr.)", unit: "antal" },
  channelization: { name: "Kanalisering", unit: "pct" },
  offshore_share: { name: "Offshore-andel", unit: "pct" },
  state_revenue: { name: "Statens afgiftsprovenu", unit: "mio_kr" },
  udlodning: { name: "Udlodningsmidler", unit: "mio_kr" },
  measured_harm: { name: "Målt skade", unit: "index" },
  true_harm: { name: "Sand skade", unit: "index" },
  harm_gap: { name: "Skjult skade (offshore)", unit: "index" },
  rofus_stock: { name: "ROFUS-bestand", unit: "antal" },
  ai_frontier: { name: "AI-front", unit: "index" },
  ai_best_cap: { name: "Bedste AI-kapabilitet", unit: "index" },
  ai_engagement: { name: "AI-engagement", unit: "x" },
  n_operators: { name: "Aktive operatører", unit: "antal" },
  n_entrants: { name: "Indtrædere", unit: "antal" },
  n_exits: { name: "Exits", unit: "antal" },
  // Monte Carlo summary keys
  final_ds_share: { name: "DS-andel (slut)", unit: "pct" },
  final_channelization: { name: "Kanalisering (slut)", unit: "pct" },
  min_channelization: { name: "Kanalisering (lavest)", unit: "pct" },
  final_market_size: { name: "Markedsstørrelse (slut)", unit: "mio_kr" },
  final_state_revenue: { name: "Provenu (slut)", unit: "mio_kr" },
  final_true_harm: { name: "Sand skade (slut)", unit: "index" },
  max_true_harm: { name: "Sand skade (max)", unit: "index" },
  final_offshore_share: { name: "Offshore-andel (slut)", unit: "pct" },
  // finance MC keys (left in English domain vocabulary but titled)
  final_price_index: { name: "Prisindeks (slut)", unit: "index" },
  min_price_index: { name: "Prisindeks (lavest)", unit: "index" },
  max_drawdown: { name: "Største fald", unit: "pct" },
  mean_volatility: { name: "Gns. volatilitet", unit: "raw" },
  bankruptcies_total: { name: "Konkurser", unit: "antal" },
  defaults_total: { name: "Misligholdelser", unit: "antal" },
  worst_systemic_risk: { name: "Systemisk risiko (max)", unit: "index" },
  final_wealth_gini: { name: "Gini (slut)", unit: "raw" },
  final_mean_leverage: { name: "Gearing (slut)", unit: "raw" },
  n_entrants_mc: { name: "Indtrædere", unit: "antal" },
  // Operator economics (competitor & industry intelligence)
  ds_ebit: { name: "DS driftsresultat (EBIT)", unit: "mio_kr" },
  ds_ebit_margin: { name: "DS EBIT-margin", unit: "pct" },
  industry_ebit: { name: "Konkurrenternes EBIT", unit: "mio_kr" },
  industry_ebit_margin: { name: "Konkurrenternes EBIT-margin", unit: "pct" },
};

export function metricLabel(key: string): string {
  return METRIC_LABELS[key]?.name ?? key;
}

export function metricUnit(key: string): Unit {
  return METRIC_LABELS[key]?.unit ?? "raw";
}

/* ------------------------------------------------------------------------ */
/* Tiny toast — replaces blocking alert()/prompt().                          */

export function toast(msg: string) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("show"), 10);
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 400);
  }, 3500);
}
