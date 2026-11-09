// src/server.js
import { openLedger } from './lib/ledger.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const db = openLedger(process.env.LEDGER_DB ?? 'ledger.db');
const statementImport = process.env.STATEMENT_IMPORT === 'on';

const server = createApp({ db, statementImport });

server.listen(port, () => {
  console.log(`listening on ${server.address().port}`);
});
