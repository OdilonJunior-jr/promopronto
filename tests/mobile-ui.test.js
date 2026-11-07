const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Script } = require('node:vm');

const root = join(__dirname, '..');
const editor = readFileSync(join(root, '_private', 'editor.html'), 'utf8');
const acesso = readFileSync(join(root, 'public', 'acesso.html'), 'utf8');
const editorScript = editor.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('o JavaScript do editor é sintaticamente válido', () => {
  assert.ok(editorScript);
  assert.doesNotThrow(() => new Script(editorScript));
});

test('layout mobile usa viewport dinâmica e safe areas', () => {
  assert.match(editor, /viewport-fit=cover/);
  assert.match(editor, /100dvh/);
  assert.match(editor, /env\(safe-area-inset-bottom\)/);
  assert.match(acesso, /100dvh/);
  assert.match(acesso, /env\(safe-area-inset-bottom\)/);
  assert.doesNotMatch(editor, /100vh/);
});

test('histórico, exportação, perfil e menu de saída existem sem botões sobrepostos', () => {
  for (const id of ['historyMenuBtn', 'undoBtn', 'redoBtn', 'resetView',
    'exportOpen', 'exportModal', 'exportPNG', 'exportVideo', 'exportJSON',
    'shareDesign', 'pauseMotion', 'profileMenuBtn', 'logoutRequest']) {
    assert.match(editor, new RegExp(`id="${id}"`), id);
  }
  assert.doesNotMatch(acesso, /id="exitBtn"/);
  assert.match(acesso, /PROMOPRONTO_LOGOUT_REQUEST/);
  assert.match(acesso, /e\.source!==\$\('editorFrame'\)\.contentWindow/);
  assert.match(acesso, /confirm\('Deseja sair da sua conta\?/);
});

test('painel tem três estados e não escurece nem desfoca a prévia', () => {
  assert.match(editor, /sheetLevel='closed'/);
  assert.match(editor, /level==='expanded'\?\.60:level==='compact'\?\.35:0/);
  assert.match(editor, /\.mobileScrim:not\(\[hidden\]\)\{display:none!important/);
  assert.match(editor, /function setupSheetGestures\(\)/);
});

test('rascunhos, canvas, imagens e ferramentas permanecem no editor', () => {
  for(const id of ['designCanvas', 'backgroundUpload', 'productUpload', 'logoUpload',
    'videoDuration', 'animSelect', 'fontSelect', 'layerText', 'projectName',
    'importProject', 'saveStatus', 'saveIndicator']) {
    assert.match(editor, new RegExp(`id="${id}"`), id);
  }
  assert.match(editor, /function migrateLegacyPriceLayout\(project\)/);
  assert.match(editor, /indexedDB\.open\(DB_NAME,1\)/);
  assert.match(editor, /window\.parent\.postMessage\(/);
});
