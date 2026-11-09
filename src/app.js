// src/app.js
import http from 'node:http';
import { importStatement, NotAStatementError } from './lib/import.js';

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function importForm() {
  return `<form method="post" enctype="multipart/form-data" action="/import">
<label>Bank statement (CSV) <input type="file" name="statement" accept=".csv"></label>
<button type="submit">Import</button>
</form>`;
}

function page(body) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Spending tracker</title></head>
<body>
<main>
<h1>Spending tracker</h1>
${body}
</main>
</body>
</html>
`;
}

function sendHtml(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
  res.end(page(body));
}

function sendText(res, status, text) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(text);
}

const MAX_UPLOAD_BYTES = 1048576;
const TOO_LARGE_MESSAGE = 'This file is too large to import. The limit is 1 MB.';

// Reads the whole request body into a Buffer, counting bytes as they arrive.
// Resolves to null as soon as the count passes the limit, without keeping the bytes.
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > limit) {
        req.removeAllListeners('data');
        req.pause();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks, total)));
    req.on('error', reject);
  });
}

async function handleImportPost(db, req, res, url) {
  try {
    const body = await readBody(req, MAX_UPLOAD_BYTES);
    if (body === null) {
      res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8', connection: 'close' });
      res.end(TOO_LARGE_MESSAGE);
      return;
    }
    const request = new Request(url, { method: 'POST', headers: req.headers, body });
    const form = await request.formData();
    const file = form.get('statement');
    if (!(file instanceof Blob)) {
      sendHtml(res, 400, '<p>Choose a bank statement (CSV) file to import.</p>');
      return;
    }
    const { added, skipped } = importStatement(db, await file.text());
    sendHtml(res, 200, `<p>Added ${added}, skipped ${skipped}</p>\n${importForm()}`);
  } catch (error) {
    if (error instanceof NotAStatementError) {
      sendHtml(res, 400, `<p>${escapeHtml(error.message)}</p>\n${importForm()}`);
      return;
    }
    sendText(res, 500, 'Something went wrong');
  }
}

export function createApp({ db, statementImport }) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') {
      const { n } = db.prepare('SELECT COUNT(*) AS n FROM transactions').get();
      const body = n === 0 ? '<p>Nothing imported yet</p>' : `<p>${n} transactions imported</p>`;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(page(body));
      return;
    }
    if (statementImport && url.pathname === '/import') {
      if (req.method === 'GET') {
        sendHtml(res, 200, `<h2>Import a statement</h2>\n${importForm()}`);
        return;
      }
      if (req.method === 'POST') {
        handleImportPost(db, req, res, url.href);
        return;
      }
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });
}
