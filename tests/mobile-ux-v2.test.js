const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {Script} = require('node:vm');
const root = join(__dirname, '..');
const editor = readFileSync(join(root, '_private', 'editor.html'), 'utf8');
const login = readFileSync(join(root, 'public', 'acesso.html'), 'utf8');
const loginJs = readFileSync(join(root, 'public', 'acesso.js'), 'utf8');
const js = editor.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('editor sem erros de sintaxe', () => assert.doesNotThrow(() => new Script(js)));
test('desktop isolado da nova interface em telas <=768px', () => {
 assert.match(editor, /@media\(max-width:768px\)/);
 assert.match(editor, /\.mobileV2Button,\.mobileFloatingTools/);
 assert.match(editor, /configureMobileToolPanels\(\)/);
});
test('dock tem exatamente Modelos, Conteúdo, Estilo, Foto', () => {
 const match = editor.match(/<nav class="mobileDock"[\s\S]*?<\/nav>/);
 assert.ok(match);
 assert.deepEqual([...match[0].matchAll(/data-tool="([^"]+)"/g)].map(m => m[1]), ['models','content','type','images']);
});
test('barra rápida de seleção com seis ações', () => {
 const bar = editor.match(/<div class="mobileFloatingTools"[\s\S]*?<\/div>/)?.[0];
 assert.ok(bar);
 assert.deepEqual([...bar.matchAll(/data-quick-action="([^"]+)"/g)].map(m=>m[1]), ['edit','font','color','size','duplicate','hide']);
});
test('bottom sheet possui três níveis e usa CSS variable para escalar preview', () => {
 assert.match(editor, /let sheetLevel='closed'/);
 assert.match(editor, /level==='expanded'\?\.60:level==='compact'\?\.35:0/);
 assert.match(editor, /padding-bottom:var\(--sheet-height,0px\)/);
 assert.match(editor, /\.stage\{position:relative/);
});
test('animação e duração dentro do fluxo exportar', () => {
 assert.match(editor, /id="mobileMotionDetails"/);
 assert.match(editor, /id="mobileMotionHost"/);
 assert.match(editor, /\$\('#mobileMotionHost'\)\.append\(motion\)/);
 assert.match(editor, /id="mobileAnimationPause"/);
});
test('onboarding em três etapas pode ser reaberto e guardado', () => {
 assert.match(editor, /promopronto_mobile_tour_v2/);
 assert.match(editor, /DICA \$\{tourStep\+1\} DE 3/);
 assert.match(editor, /id="mobileHelp"/);
});
test('menu de conta e logout com confirmação mantidos', () => {
 assert.match(editor, /id="logoutRequest"/);
 assert.match(loginJs, /confirm\('Sair da conta\?/);
 assert.match(loginJs, /PROMOPRONTO_LOGOUT_REQUEST/);
});
test('login usa viewport dinâmico, safe-areas e correção do teclado', () => {
 assert.match(login, /100dvh/);
 assert.match(login, /env\(safe-area-inset-bottom\)/);
 assert.match(loginJs, /visualViewport\?\.addEventListener\('resize', focusVisibleField\)/);
 assert.match(loginJs, /scrollIntoView/);
});
