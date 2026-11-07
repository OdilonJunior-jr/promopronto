// PromoPronto — editor protegido, com suporte a credencial de serviço em Base64.
// O editor e o Firestore só são acessados após validação do token e da compra.
'use strict';
const { createHash, createPrivateKey } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const validEmail = email => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
const configured = () => Boolean(
  process.env.FIREBASE_SERVICE_ACCOUNT_B64 ||
  (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
);

function getServiceAccount() {
  let account;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_B64.trim();
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
      throw new Error('FORMATO_BASE64_INVALIDO');
    }
    try {
      account = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    } catch {
      throw new Error('JSON_BASE64_INVALIDO');
    }
  } else {
    // Compatibilidade com as três variáveis anteriores.
    account = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY
    };
  }

  if (!account || account.type !== 'service_account' ||
      typeof account.project_id !== 'string' ||
      typeof account.client_email !== 'string' ||
      typeof account.private_key !== 'string') {
    throw new Error('CAMPOS_CREDENCIAL_AUSENTES');
  }
  if (process.env.FIREBASE_PROJECT_ID && account.project_id !== process.env.FIREBASE_PROJECT_ID) {
    throw new Error('PROJETO_CREDENCIAL_DIVERGENTE');
  }
  const privateKey = account.private_key.replace(/\\n/g, '\n').trim() + '\n';
  try { createPrivateKey(privateKey); }
  catch { throw new Error('CHAVE_PRIVADA_PEM_INVALIDA'); }

  return {
    projectId: account.project_id,
    clientEmail: account.client_email,
    privateKey
  };
}

function safeErrorCode(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  const message = typeof error?.message === 'string' ? error.message : '';
  if (/^(auth\/|app\/|firestore\/)[a-z0-9_-]+$/i.test(code)) return code;
  if (/^[A-Z0-9_]{5,60}$/.test(message)) return message;
  return 'erro-nao-classificado'; // Nunca registrar token, JSON ou chave no log.
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método não permitido' });
  if (!configured()) return res.status(503).json({ ok: false, error: 'Autenticação ainda não configurada' });
  const authorization = String(req.headers.authorization || '');
  if (!authorization.startsWith('Bearer ')) return res.status(401).json({ ok: false, error: 'É necessário entrar' });

  let stage = 'credencial';
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      const serviceAccount = getServiceAccount();
      stage = 'inicializacao';
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }

    stage = 'validacao-token';
    const user = await admin.auth().verifyIdToken(authorization.slice(7), true);
    if (user.email_verified !== true || !validEmail(user.email)) {
      return res.status(403).json({ ok: false, error: 'Confirme seu e-mail' });
    }

    stage = 'consulta-compra';
    const emailHash = createHash('sha256').update(user.email.trim().toLowerCase()).digest('hex');
    const entitlement = await admin.firestore().collection('entitlements').doc(emailHash).get();
    if (!entitlement.exists || entitlement.data()?.active !== true) {
      return res.status(403).json({ ok: false, error: 'Compra não aprovada para este e-mail' });
    }

    stage = 'entrega-editor';
    const editor = readFileSync(join(process.cwd(), '_private', 'editor.html'), 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
    return res.status(200).send(editor);
  } catch (error) {
    console.error('[PromoPronto /api/editor]', 'etapa=' + stage, 'codigo=' + safeErrorCode(error));
    if (String(error?.code || '').startsWith('auth/')) {
      return res.status(401).json({ ok: false, error: 'Sessão inválida' });
    }
    return res.status(503).json({ ok: false, error: 'Serviço de acesso indisponível' });
  }
};
