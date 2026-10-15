const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function helpers(fetch) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('lib/document-upload.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, fetch, Error });
  return module.exports;
}

test('Word extensions and the 4 MiB boundary are checked before upload', () => {
  const { validateDocumentFile } = helpers();
  assert.equal(validateDocumentFile({ name: 'Skripsi.DOCX', size: 4194304 }), null);
  assert.ok(validateDocumentFile({ name: 'empty.doc', size: 0 }));
  assert.ok(validateDocumentFile({ name: 'large.docx', size: 4194305 }));
  assert.ok(validateDocumentFile({ name: 'skripsi.pdf', size: 10 }));
});

test('Vercel non-JSON 413 responses have an actionable message', async () => {
  const { submitDocument } = helpers(async () => new Response('FUNCTION_PAYLOAD_TOO_LARGE', { status: 413 }));
  await assert.rejects(submitDocument('/api/documents', new FormData()), /maksimum 4 MB/);
});

test('Session and server error responses are preserved', async () => {
  for (const [status, body, expected] of [[401, null, /Sesi berakhir/], [500, { error: 'Penyimpanan gagal' }, /Penyimpanan gagal/]]) {
    const { submitDocument } = helpers(async () => Response.json(body, { status }));
    await assert.rejects(submitDocument('/api/documents', new FormData()), expected);
  }
});

test('Disconnected requests warn about possible duplicate submission', async () => {
  const { submitDocument } = helpers(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(submitDocument('/api/documents', new FormData()), /riwayat dokumen/);
});

test('Unexpected successful responses are not reported as saved', async () => {
  const { submitDocument } = helpers(async () => new Response('<html>Login</html>'));
  await assert.rejects(submitDocument('/api/documents', new FormData()), /Respons server tidak valid/);
});

test('Successful upload returns the saved version', async () => {
  const { submitDocument } = helpers(async () => Response.json({ ok: true, versionId: 'saved-version' }));
  assert.equal((await submitDocument('/api/documents', new FormData())).versionId, 'saved-version');
});
