/** Introduction page — explains the system simply (target reader: ~20 years
 *  old, smart, zero simulation background). Short on purpose. */
export function IntroPage({ onStart }: { onStart: () => void }) {
  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <div className="card hero" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 6px" }}>Hvad er det her?</h2>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          En <b>simulator af det danske spilmarked</b>. Vi har bygget en lille kunstig
          verden: 500 forskellige spillere med hver deres vaner og budget, Danske Spil,
          konkurrenterne (bet365, Betano, …), ulovlige udenlandske sider, en myndighed
          og politikere. Hver måned vælger alle, hvad de gør — og så ser vi, hvad der
          sker med markedet over 5-6 år.
        </p>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>🎛️ Hvad kan du gøre?</h3>
          <p className="muted" style={{ lineHeight: 1.6 }}>
            Skru på virkeligheden og se konsekvenserne: Hvad sker der, hvis reklamer
            forbydes? Hvis AI pludselig bliver vildt god? Hvis en ny aggressiv
            konkurrent går ind? Du vælger et scenarie (eller bygger dit eget chok),
            trykker <b>Kør</b>, og følger kurverne tegne sig måned for måned.
          </p>
        </div>
        <div className="card">
          <h3>📊 Hvad skal du kigge efter?</h3>
          <p className="muted" style={{ lineHeight: 1.6 }}>
            Fire ting: <b>markedets størrelse</b> (mia. kr.), <b>Danske Spils andel</b>,{" "}
            <b>antal kunder</b> og <b>kanaliseringen</b> — hvor stor en del af spillet
            der foregår hos lovlige, danske udbydere frem for ulovlige sider. Hold
            også øje med "målt vs. sand skade": stramninger kan <i>ligne</i> en succes,
            fordi problemerne bare flytter derhen, hvor ingen måler dem.
          </p>
        </div>
        <div className="card">
          <h3>🎲 Hvorfor er graferne usikre?</h3>
          <p className="muted" style={{ lineHeight: 1.6 }}>
            Fordi virkeligheden er det. Ingen kender fx den præcise kanalisering (et
            sted mellem 72 og 92 %), så vi tegner den som en <b>korridor</b> i stedet
            for én linje. Og på Monte Carlo-siden kører vi det samme scenarie 25+
            gange og viser <b>viften</b> af mulige udfald. Regel nr. 1: læs aldrig én
            kurve som en forudsigelse.
          </p>
        </div>
        <div className="card">
          <h3>⚠️ Hvad er det IKKE?</h3>
          <p className="muted" style={{ lineHeight: 1.6 }}>
            Ikke en krystalkugle. Modellen forudsiger ikke fremtiden — den viser,
            hvilke <b>reaktionsmønstre og kædereaktioner</b> der er plausible under
            klare antagelser. Alle antagelser er dokumenteret med kilde og usikkerhed
            i parameterregistret, og konklusioner tæller kun, hvis de holder på tværs
            af antagelserne.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Sådan kommer du i gang — 3 trin</h3>
        <ol style={{ lineHeight: 1.9, margin: "8px 0", paddingLeft: 22 }}>
          <li>Tryk på knappen herunder — den kører det kalibrerede 2024/25-baseline.</li>
          <li>Gå tilbage til <b>Opsætning</b> og prøv et chok-scenarie, fx <i>Spilpakke 1</i> eller <i>Wild AI boom</i>.</li>
          <li>Kør dit favorit-scenarie 25 gange under <b>Monte Carlo</b>, og læs viften — ikke enkeltkurver.</li>
        </ol>
        <button className="primary" onClick={onStart} style={{ marginTop: 6 }}>
          Kom i gang →
        </button>
      </div>
    </div>
  );
}
