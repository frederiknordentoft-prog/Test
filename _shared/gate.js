/* ---------------------------------------------------------------------------
   gate.js — simpel adgangskode foran en side på sitet.

       <link rel="stylesheet" href="../_shared/gate.css" />
       <script src="../_shared/gate.js"
               data-gate="minapp"
               data-hash="<sha256 af slug:kodeord>"
               data-title="Min App"
               data-hint="Spørg Frederik"></script>

   Lav data-hash med:  scripts/gate-hash.sh minapp "mit kodeord"

   VÆR ÆRLIG OM HVAD DETTE ER
   Sitet er et offentligt GitHub-repo. Alle filer på siden kan hentes direkte
   uden at gå gennem denne dialog, og hashen står i kildekoden og kan brute-
   forces offline. Det her holder nysgerrige naboer og tilfældige besøgende
   ude — ikke nogen der vil ind. Læg aldrig noget bag den, som det ville gøre
   ondt at få offentliggjort. Se LOGIN-afsnittet i PUBLICER.md for de rigtige
   løsninger, hvis der skal være reel adgangskontrol.
   --------------------------------------------------------------------------- */
(function () {
  "use strict";

  var script = document.currentScript;
  var slug = (script && script.dataset.gate) || "site";
  var expected = ((script && script.dataset.hash) || "").toLowerCase();
  var title = (script && script.dataset.title) || document.title || "Låst side";
  var hint = (script && script.dataset.hint) || "";
  var storeKey = "gate:" + slug;

  function open() {
    document.documentElement.classList.add("gate-open");
    var el = document.querySelector(".gate");
    if (el) el.remove();
  }

  // Ingen hash konfigureret = ingen lås. Bedre end en side ingen kan komme ind på.
  if (!expected) return open();

  try {
    if (localStorage.getItem(storeKey) === expected) return open();
  } catch (e) {
    /* privat browsing kan blokere localStorage — så spørger vi bare hver gang */
  }

  function sha256(text) {
    if (!window.crypto || !window.crypto.subtle) {
      return Promise.reject(new Error("insecure-context"));
    }
    return crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(text))
      .then(function (buf) {
        return Array.prototype.map
          .call(new Uint8Array(buf), function (b) {
            return b.toString(16).padStart(2, "0");
          })
          .join("");
      });
  }

  function render() {
    var gate = document.createElement("div");
    gate.className = "gate";
    gate.innerHTML =
      '<div class="gate-card">' +
      '<div class="gate-lock">🔒</div>' +
      '<h1 class="gate-title"></h1>' +
      '<p class="gate-sub"></p>' +
      '<form class="gate-form">' +
      '<input class="gate-input" type="password" autocomplete="current-password" ' +
      'placeholder="Adgangskode" aria-label="Adgangskode" />' +
      '<button class="gate-btn" type="submit">Lås op</button>' +
      "</form>" +
      '<p class="gate-error" role="alert"></p>' +
      "</div>";

    gate.querySelector(".gate-title").textContent = title;
    gate.querySelector(".gate-sub").textContent = hint || "Siden er låst.";
    document.body.appendChild(gate);

    var card = gate.querySelector(".gate-card");
    var form = gate.querySelector(".gate-form");
    var input = gate.querySelector(".gate-input");
    var button = gate.querySelector(".gate-btn");
    var error = gate.querySelector(".gate-error");

    input.focus();

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!input.value) return;

      button.disabled = true;
      error.textContent = "";

      sha256(slug + ":" + input.value).then(
        function (digest) {
          button.disabled = false;
          if (digest === expected) {
            try {
              localStorage.setItem(storeKey, expected);
            } catch (e) {
              /* ikke kritisk — brugeren taster bare igen næste gang */
            }
            return open();
          }
          error.textContent = "Forkert adgangskode.";
          input.value = "";
          input.focus();
          card.classList.remove("gate-shake");
          void card.offsetWidth; // genstart animationen
          card.classList.add("gate-shake");
        },
        function () {
          button.disabled = false;
          error.textContent =
            "Kræver https:// eller localhost — ikke file://.";
        }
      );
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
