// Worker til harnesset: kører spil og sender nøgletallene tilbage.
import { parentPort } from 'node:worker_threads';
import { koerSpil, type BotNavn } from './game';

parentPort!.on('message', (m: { bot: BotNavn; seed: number } | null) => {
  if (m === null) {
    process.exit(0);
  }
  parentPort!.postMessage(koerSpil(m.bot, m.seed));
});
