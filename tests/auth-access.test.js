'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.join(__dirname, '..');
const originalModuleLoad = Module._load;
const handlerPath = require.resolve('../api/editor');
const previousB64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;

function makeResponse() {
  return {
    statusCode: 200, headers: {}, body: null, finished: false,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; this.finished = true; return this; },
    send(value) { this.body = value; this.finished = true; return this; },
    end() { this.finished = true; return this; }
  };
}
async function withFirebase({ verified = true, active = true, authError = null, email = 'comprador@example.com' }, invoke) {
  process.env.FIREBASE_SERVICE_ACCOUNT_B64 = 'YQ==';
  const calls = { checkedRevocation: false, entitlementQueries: 0, requestedDoc: null };
  const admin = {
    apps: [{}],
    auth() {
      return { async verifyIdToken(token, revoked) {
        calls.checkedRevocation = revoked;
        if (authError) throw Object.assign(new Error('authentication failed'), { code: authError });
        if (token !== 'valid-test-token') throw Object.assign(new Error('invalid token'), { code: 'auth/invalid-id-token' });
        return { email, email_verified: verified, uid: 'test-user' };
      } };
    },
    firestore() {
      return {
        collection(name) {
          assert.equal(name, 'entitlements');
          return {
            doc(hash) {
              calls.requestedDoc = hash;
              return { async get() {
                calls.entitlementQueries++;
                return { exists: active, data() { return { active }; } };
              } };
            }
          };
        }
      };
    }
  };
  Module._load = function(request, parent, isMain) {
    if (request === 'firebase-admin') return admin;
    return originalModuleLoad.call(this, request, parent, isMain);
  };
  delete require.cache[handlerPath];
  try { return await invoke(require(handlerPath), calls); }
  finally {
    Module._load = originalModuleLoad;
    delete require.cache[handlerPath];
    if (previousB64 === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    else process.env.FIREBASE_SERVICE_ACCOUNT_B64 = previousB64;
  }
}
function request(method, token = 'valid-test-token') { return { method, headers: { authorization: `Bearer ${token}` } }; }

test('HEAD autorizado exige token verificado, compra ativa e nao entrega editor', async () => {
  await withFirebase({}, async (handler, calls) => {
    const res = makeResponse(); await handler(request('HEAD'), res);
    assert.equal(res.statusCode, 204); assert.equal(res.finished, true);
    assert.equal(res.body, null); assert.equal(calls.entitlementQueries, 1);
    assert.equal(calls.checkedRevocation, true);
    assert.match(calls.requestedDoc, /^[a-f0-9]{64}$/);
    assert.equal(res.headers['cache-control'], 'no-store, max-age=0');
  });
});
test('HEAD bloqueia compra reembolsada ou revogada, igual ao GET', async () => {
  await withFirebase({ active: false }, async handler => {
    for (const method of ['HEAD', 'GET']) {
      const res = makeResponse(); await handler(request(method), res);
      assert.equal(res.statusCode, 403); assert.equal(res.body.ok, false);
    }
  });
});
test('HEAD bloqueia e-mail nao verificado antes de consultar compra', async () => {
  await withFirebase({ verified: false }, async (handler, calls) => {
    const res = makeResponse(); await handler(request('HEAD'), res);
    assert.equal(res.statusCode, 403); assert.equal(calls.entitlementQueries, 0);
  });
});
test('HEAD bloqueia token revogado ou invalido', async () => {
  await withFirebase({ authError: 'auth/id-token-revoked' }, async handler => {
    const res = makeResponse(); await handler(request('HEAD'), res);
    assert.equal(res.statusCode, 401);
  });
});
test('GET continua protegendo o editor e retorna HTML somente para comprador', async () => {
  await withFirebase({}, async handler => {
    const res = makeResponse(); await handler(request('GET'), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'text/html; charset=utf-8');
    assert.match(res.body, /PromoPronto/i);
  });
});
test('novos formularios nao criam conta por e-mail informado ou pulam autorizacao', () => {
  const html = fs.readFileSync(path.join(root, 'public/acesso.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'public/acesso.js'), 'utf8');
  assert.match(html, /autocomplete="username"/);
  assert.match(html, /autocomplete="current-password"/);
  assert.match(html, /autocomplete="new-password"/);
  assert.match(js, /browserLocalPersistence/);
  assert.match(js, /signInWithEmailAndPassword/);
  assert.match(js, /sendSignInLinkToEmail/);
  assert.match(js, /signInWithEmailLink/);
  assert.match(js, /sendPasswordResetEmail/);
  assert.match(js, /updatePassword/);
  assert.match(js, /await verifyPurchase\(user\)/);
  assert.match(js, /requestEditor\(user, 'HEAD'\)/);
  assert.match(js, /window\.confirm\('Sair da conta\?/);
  assert.doesNotMatch(js, /createUserWithEmailAndPassword|fetchSignInMethodsForEmail/);
  assert.doesNotMatch(js, /service_account|FIREBASE_PRIVATE_KEY|KIWIFY_WEBHOOK_TOKEN/);
});
test('somente a area de acesso mudou no projeto publico', () => {
  const html = fs.readFileSync(path.join(root, 'public/acesso.html'), 'utf8');
  assert.match(html, /100dvh/);
  assert.match(html, /safe-area-inset-bottom/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /font-size:16px/);
  assert.match(html, /id="editorFrame"/);
});
