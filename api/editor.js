// Editor protegido: exige token Firebase válido e compra ativa no Firestore.
// Antes de configurar Firebase, acesso BLOQUEADO por padrão.
'use strict';
const {createHash} = require('node:crypto');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const validEmail = email => typeof email==='string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length<=254;
function serviceConfig(){
  return Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
}
module.exports = async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Método não permitido'});
  if(!serviceConfig())return res.status(503).json({ok:false,error:'Autenticação ainda não configurada'});
  const header=String(req.headers.authorization||'');
  if(!header.startsWith('Bearer '))return res.status(401).json({ok:false,error:'É necessário entrar'});
  try{
    // Importação tardia: ao publicar a etapa 1, Firebase ainda não é necessário.
    const admin=require('firebase-admin');
    if(!admin.apps.length){admin.initializeApp({credential:admin.credential.cert({
      projectId:process.env.FIREBASE_PROJECT_ID,
      clientEmail:process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n')
    })});}
    const user=await admin.auth().verifyIdToken(header.slice(7),true);
    if(user.email_verified!==true||!validEmail(user.email))return res.status(403).json({ok:false,error:'Confirme seu e-mail'});
    const emailHash=createHash('sha256').update(user.email.trim().toLowerCase()).digest('hex');
    const entitlement=await admin.firestore().collection('entitlements').doc(emailHash).get();
    if(!entitlement.exists||entitlement.data()?.active!==true)return res.status(403).json({ok:false,error:'Compra não aprovada para este e-mail'});
    // Arquivo reservado ao servidor — NÃO colocar em public/.
    const editor=readFileSync(join(process.cwd(),'_private','editor.html'),'utf8');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy',"frame-ancestors 'self'");
    return res.status(200).send(editor);
  }catch(e){
    if(String(e.code||'').startsWith('auth/'))return res.status(401).json({ok:false,error:'Sessão inválida'});
    console.error('Erro ao autenticar ou servir editor',e.code||e.message);
    return res.status(503).json({ok:false,error:'Serviço de acesso indisponível'});
  }
};
