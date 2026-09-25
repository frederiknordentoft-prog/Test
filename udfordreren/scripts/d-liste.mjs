// Skriver docs/D-VAERDIER.md: alle designestimater [D] og afledte tal [A] i src/data/, med fil og linje.
// Kør igen efter balancering: npm run dliste
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rod = fileURLToPath(new URL('..', import.meta.url));
const dataDir = join(rod, 'src', 'data');
const filer = readdirSync(dataDir).filter((f) => f.endsWith('.ts') && f !== 'archive.ts').sort();

const afsnit = [];
let d = 0;
let a = 0;
for (const fil of filer) {
  const linjer = readFileSync(join(dataDir, fil), 'utf8').split('\n');
  const fund = [];
  linjer.forEach((linje, i) => {
    const harD = /\[D[\]\-:\s]/.test(linje) || /\[D-/.test(linje);
    const harA = /\[A[\]\/:\s]/.test(linje) || /\[F\/A\]/.test(linje);
    if (!harD && !harA) return;
    if (harD) d += 1;
    else a += 1;
    const tekst = linje.trim().replace(/\|/g, '\\|').slice(0, 220);
    fund.push(`| ${i + 1} | ${harD ? 'D' : 'A'} | \`${tekst.replace(/`/g, "'")}\` |`);
  });
  if (fund.length) afsnit.push(`## src/data/${fil}\n\n| Linje | Type | Kode og kommentar |\n|---:|:-:|---|\n${fund.join('\n')}`);
}

const md = `# Designestimater og afledte tal

Genereret af \`npm run dliste\` (scripts/d-liste.mjs). Alle tal, der styrer balancen, står i \`src/data/\` og er markeret
**[F]** fakta, **[A]** afledt (fx valutaomregnet) eller **[D]** designestimat. Her er de ${d} linjer med [D] og ${a} med [A].
Ændr værdierne i \`src/data/\` og kør \`npm run sim\` bagefter: de ti assertions i \`sim/report.md\` skal stadig være OK.

${afsnit.join('\n\n')}
`;
writeFileSync(join(rod, 'docs', 'D-VAERDIER.md'), md);
console.log(`docs/D-VAERDIER.md: ${d} [D]-linjer og ${a} [A]-linjer fra ${filer.length} datafiler.`);
