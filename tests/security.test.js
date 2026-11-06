const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const publicDir=path.join(root,'public');
const privateEditor=path.join(root,'_private','editor.html');
function response(){return {statusCode:200,body:null,headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;return this},status(n){this.statusCode=n;return this},json(value){this.body=value;return this},send(v){this.body=v;return this}}}
test('o editor pago fica fora da pasta pública',()=>{
  assert(fs.existsSync(privateEditor));
  assert(!fs.existsSync(path.join(publicDir,'editor.html')));
  assert(!fs.existsSync(path.join(publicDir,'_private')));
});
test('site estático, config e páginas existentes',()=>{
  for(const file of ['index.html','acesso.html','config.js','favicon.svg']) assert(fs.existsSync(path.join(publicDir,file)),file);
});
test('endpoint bloqueia acesso quando ainda não configurado',async()=>{
  const prev=['FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY'].map(k=>[k,process.env[k]]);
  for(const [k] of prev)delete process.env[k];
  const handler=require('../api/editor');
  const res=response();await handler({method:'GET',headers:{}},res);
  assert.equal(res.statusCode,503);assert.equal(res.body.ok,false);
  for(const [k,v] of prev)if(v!==undefined)process.env[k]=v;
});
test('endpoint não aceita POST',async()=>{
  const handler=require('../api/editor');const res=response();await handler({method:'POST',headers:{}},res);
  assert.equal(res.statusCode,405);
});
test('site sem checkout aponta para seção de explicação',()=>{
  const html=fs.readFileSync(path.join(publicDir,'index.html'),'utf8');
  assert(html.includes('id="como-funciona"'));assert(html.includes('Conhecer como funciona'));
  assert(!html.includes('src="data:image/jpeg;base64'));
});
