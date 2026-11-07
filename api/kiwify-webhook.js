// PromoPronto Studio — Webhook de vendas da Kiwify.
// IMPORTANTE: requer KIWIFY_WEBHOOK_TOKEN e KIWIFY_PRODUCT_ID na Vercel.
// Em modo padrão de teste, valida os eventos MAS NÃO ALTERA O FIRESTORE.
'use strict';
const { createHmac, createHash, timingSafeEqual, createPrivateKey } = require('node:crypto');

const hash = value => createHash('sha256').update(value).digest('hex');
const isEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const readString = value => typeof value === 'string' ? value.trim() : '';

function getSignature(req) {
  const url = new URL(req.url || '/', 'https://promopronto.vercel.app');
  return url.searchParams.get('signature') || '';
}
function checkSignature(rawBody, received, secret) {
  if (!/^[a-f0-9]{40}$/i.test(received)) return false;
  const calculated = createHmac('sha1', secret).update(rawBody).digest();
  const signature = Buffer.from(received, 'hex');
  return signature.length === calculated.length && timingSafeEqual(signature, calculated);
}
async function rawBody(req, maxBytes = 256 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const part of req) {
    total += part.length;
    if (total > maxBytes) { const err = new Error('Payload acima do limite'); err.httpStatus = 413; throw err; }
    chunks.push(part);
  }
  return Buffer.concat(chunks);
}
function getFirebaseAdmin() {
  const admin = require('firebase-admin');
  if (admin.apps.length) return admin;
  let data;
  const encoded = readString(process.env.FIREBASE_SERVICE_ACCOUNT_B64);
  if (encoded) {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) throw new Error('Credencial em Base64 inválida');
    data = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  } else {
    data = {
      type:'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY
    };
  }
  if (!data || data.type !== 'service_account' || !data.project_id || !data.client_email || !data.private_key) {
    throw new Error('Credencial Firebase incompleta');
  }
  if (data.project_id !== 'promopronto-studio') throw new Error('Projeto Firebase divergente');
  const privateKey = data.private_key.replace(/\\n/g,'\n').trim() + '\n';
  createPrivateKey(privateKey);
  admin.initializeApp({credential:admin.credential.cert({
    projectId:data.project_id,clientEmail:data.client_email,privateKey
  })});
  return admin;
}
function eventAction(payload) {
  const type = readString(payload?.webhook_event_type).toLowerCase();
  const status = readString(payload?.order_status).toLowerCase();
  // Não confiar somente em status ou somente em tipo, para não ativar compra pendente.
  if (type === 'order_approved' && status === 'paid') return 'approve';
  if (['order_refunded','order_refund','refund','order_chargeback','order_chargedback','chargeback'].includes(type) ||
      ['refunded','chargeback','chargedback'].includes(status)) return 'revoke';
  return 'ignore';
}

async function updateAccess(db,payload,action) {
  const orderId = readString(payload.order_id);
  const email = readString(payload.Customer?.email).toLowerCase();
  if (!orderId || orderId.length > 180) return {code:422,result:'pedido_ausente'};
  if (action === 'approve' && !isEmail(email)) return {code:422,result:'email_ausente'};

  const orderDoc = db.collection('kiwify_orders').doc(hash(orderId));
  return db.runTransaction(async tx => {
    const currentOrder = await tx.get(orderDoc);
    const old = currentOrder.exists ? currentOrder.data() : null;
    const oldState = old?.state || null;
    // O reembolso/chargeback da mesma compra prevalece se os eventos chegarem fora de ordem.
    if (oldState === 'revoked' || (oldState === 'active' && action === 'approve')) {
      return {code:200,result:'duplicado_ou_irreversivel'};
    }
    const emailHash = old?.emailHash || (isEmail(email) ? hash(email) : null);
    if (!emailHash) return {code:422,result:'comprador_nao_identificado'};
    if (old?.emailHash && isEmail(email) && hash(email) !== old.emailHash) {
      return {code:409,result:'email_divergente'};
    }
    const entitlementDoc = db.collection('entitlements').doc(emailHash);
    const existing = await tx.get(entitlementDoc);
    const saved = existing.exists ? existing.data() : {};
    // Mantém autorizações manuais anteriores (incluindo a conta do proprietário).
    const manualActive = saved.manualActive === true ||
      (saved.active === true && !Object.prototype.hasOwnProperty.call(saved,'activeOrderCount'));
    const previousCount = Number.isSafeInteger(saved.activeOrderCount) && saved.activeOrderCount >= 0
      ? saved.activeOrderCount : 0;
    const delta = action === 'approve' ? 1 : (oldState === 'active' ? -1 : 0);
    const count = Math.max(0, previousCount + delta);
    const active = manualActive || count > 0;

    tx.set(orderDoc, {
      state: action === 'approve' ? 'active':'revoked',
      emailHash, productId: payload.Product.product_id,
      // Nunca gravar e-mail, CPF, dados do cartão ou token no Firestore.
      updatedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    tx.set(entitlementDoc, {
      active, manualActive, activeOrderCount:count,
      updatedAt:require('firebase-admin').firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    return {code:200,result:action === 'approve' ? 'acesso_liberado':'acesso_atualizado'};
  });
}

async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method !== 'POST') return res.status(405).json({ok:false,error:'metodo_nao_permitido'});
  const secret = readString(process.env.KIWIFY_WEBHOOK_TOKEN);
  const productId = readString(process.env.KIWIFY_PRODUCT_ID);
  if (!secret || !productId) return res.status(503).json({ok:false,error:'integracao_ainda_nao_configurada'});
  let body;
  try { body = await rawBody(req); }
  catch (error) { return res.status(error.httpStatus || 400).json({ok:false,error:'corpo_invalido'}); }
  if (!checkSignature(body,getSignature(req),secret)) {
    return res.status(401).json({ok:false,error:'assinatura_invalida'});
  }
  let payload;
  try { payload=JSON.parse(body.toString('utf8')); }
  catch { return res.status(400).json({ok:false,error:'json_invalido'}); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return res.status(400).json({ok:false,error:'json_invalido'});
  // Vincular ao produto correto impede uma compra de outro produto de liberar o Studio.
  if (readString(payload.Product?.product_id) !== productId) return res.status(200).json({ok:true,result:'outro_produto'});
  const action=eventAction(payload);
  if (action === 'ignore') return res.status(200).json({ok:true,result:'evento_ignorado'});
  // O padrão é simular: test events NÃO liberam o editor até ativação explícita.
  if (process.env.KIWIFY_WEBHOOK_LIVE !== 'true') return res.status(200).json({ok:true,result:'teste_validado_sem_gravar'});

  try {
    const admin=getFirebaseAdmin();
    const result=await updateAccess(admin.firestore(),payload,action);
    // Resposta de erro permite à Kiwify reenviar eventos quando o banco falhar.
    if (result.code >= 400) return res.status(result.code).json({ok:false,error:result.result});
    return res.status(result.code).json({ok:true,result:result.result});
  } catch (error) {
    // Nunca imprimir dados de compra, cabeçalhos, tokens ou segredos.
    console.error('[PromoPronto webhook] falha_de_integracao', error.code || 'erro_servidor');
    return res.status(503).json({ok:false,error:'falha_no_processamento'});
  }
}
module.exports=handler;
module.exports.config={api:{bodyParser:false}};
// Apenas para testes automatizados. Não é uma rota HTTP.
module.exports._test={checkSignature,eventAction,updateAccess};
