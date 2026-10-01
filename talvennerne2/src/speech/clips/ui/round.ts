// Fixed clips for the round screen (src/ui/screens/child/RoundScreen.tsx, src/ui/hint, src/ui/task):
// praise, the error flow, the lightbulb, the golden egg, pause and the round's own strategy words.
// Sentences carry their punctuation; fragments (words read between numbers) carry none.
export const clips = {
  // Praise after a right answer (rotating, never the same twice in a row)
  's.round.praise.1': 'Flot!',
  's.round.praise.2': 'Rigtigt!',
  's.round.praise.3': 'Godt regnet!',
  's.round.praise.4': 'Super!',
  's.round.praise.5': 'Sådan!',
  's.round.praise.6': 'Ja, det passer!',
  's.round.praise.7': 'Du fandt det!',
  's.round.praise.8': 'Godt klaret!',
  // A mistake: the gentle opener before the strategy
  's.round.oops.1': 'Lad os se på det sammen.',
  's.round.oops.2': 'Næsten. Se her.',
  's.round.oops.3': 'Hmm, lad os tænke sammen.',
  // The confirm button when the answer is not a word or a number
  's.round.tapHere': 'Tryk her.',
  's.round.confirm': 'Tryk på det rigtige svar',
  // Lightbulb and the tick nudge (SPEC §3.4–3.5)
  's.round.help': 'Se her. Det kan hjælpe dig.',
  's.round.checkNudge': 'Tryk på fluebenet, når du er færdig.',
  // The golden egg
  's.round.golden.appear': 'Et guldæg! Kan du fange det?',
  's.round.golden.caught': 'Du fangede guldægget!',
  's.round.golden.flew': 'Guldægget fløj videre. Det gør ikke noget.',
  // Combo
  's.round.combo.five': 'Fem rigtige i træk!',
  's.round.perfect': 'Perfekt tur!',
  // Pause and coming back
  's.round.pause.title': 'Pause',
  's.round.pause.body': 'Turen bliver gemt, så du kan spille videre senere.',
  's.round.pause.resume': 'Spil videre',
  's.round.continue': 'Tryk for at fortsætte',
  's.round.done': 'Turen er færdig. Godt gået!',
  // countTap
  's.round.count.take': 'Læg i kurven',
  's.round.count.back': 'Tag en op af kurven',
  // The round's own strategy words, used when a skill brings no words of its own
  's.round.hint.look': 'Se godt efter.',
  's.round.hint.answerIs': 'Svaret er',
  's.round.hint.add': 'Læg dem sammen.',
  's.round.hint.sub': 'Tag dem væk, og tæl dem, der er tilbage.',
  's.round.hint.makeTen': 'Fyld tieren op først.',
  's.round.hint.backToTen': 'Gå tilbage til ti først.',
  's.round.hint.columns': 'Regn enerne først og så tierne.',
  's.round.hint.forgotCarry': 'Ti enere bliver til en tier. Den skal med over til tierne.',
  's.round.hint.smallerFromLarger': 'Der er ikke enere nok. Lån en tier, og byt den til ti enere.',
  's.round.hint.digitSwap': 'Tierne kommer først, så enerne.',
  's.round.hint.tensFirst': 'Tæl tierne først.',
  's.round.hint.count': 'Tæl dem en ad gangen.',
  's.round.hint.thereAre': 'Der er',
  's.round.hint.array': 'Tæl rækkerne, og læg dem sammen.',
  's.round.hint.splitArray': 'Del rækkerne op i to dele, du kender.',
  's.round.hint.coinsSum': 'Læg de store mønter sammen først.',
  's.round.hint.clockMove': 'Følg den lange viser rundt.',
  's.round.hint.line': 'Se på tallinjen.',
  's.round.word.tens': 'tiere',
  's.round.word.ten': 'tier',
  's.round.word.ones': 'enere',
  's.round.word.one': 'ener',
}

export const PRAISE_CLIPS = Object.keys(clips).filter((id) => id.startsWith('s.round.praise.'))
export const OOPS_CLIPS = Object.keys(clips).filter((id) => id.startsWith('s.round.oops.'))
