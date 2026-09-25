// Worker-start for harnesset: registrér tsx (TypeScript) i worker-tråden og indlæs den egentlige worker.
import { register } from 'tsx/esm/api';

register();
await import('./worker.ts');
