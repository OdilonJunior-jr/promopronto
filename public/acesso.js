// PromoPronto Studio — acesso dos compradores.
// Usa a configuração pública de /config.js. Tokens Firebase nunca são armazenados por este código.
// O acesso real ao editor continua exigindo a confirmação do servidor em /api/editor.
const cfg = window.PROMOPRONTO_CONFIG || {};
const firebaseConfig = cfg.firebase || {};
const $ = id => document.getElementById(id);
const panels = [...document.querySelectorAll('[data-panel]')];
const validConfig = ['apiKey', 'projectId', 'authDomain', 'appId'].every(key =>
  typeof firebaseConfig[key] === 'string' && firebaseConfig[key].length > 0 && !/^(INSIRA_|SEU_)/.test(firebaseConfig[key])
);
const viewTexts = {
  checking: ['Preparando seu acesso', 'Conferindo se você já está conectado.'],
  login: ['Bem-vindo de volta', 'Entre com o e-mail da sua compra e sua senha.'],
  link: ['Seu primeiro acesso', 'Receba um link seguro para confirmar seu e-mail. Depois, você poderá criar uma senha.'],
  confirmLink: ['Confirme seu e-mail', 'Para concluir o acesso neste dispositivo, digite o endereço que recebeu o link.'],
  reset: ['Recuperar senha', 'Enviaremos as instruções ao e-mail da sua conta, se estiver cadastrado.'],
  setup: ['Crie sua senha', 'Na próxima vez, você poderá entrar sem abrir o e-mail.'],
  blocked: ['Acesso não liberado', 'Sua identidade foi verificada, mas precisamos confirmar seu acesso ao Studio.']
};
let auth;
let firebase;
let mode = 'checking';
let resolvingLink = false;
let editorOpen = false;
let opening = false;
let pollHandle = null;
let healthCheck = null;
let currentUid = null;
let failedChecks = 0;
let pendingSetupUser = null;
let logoutProcessing = false;
const EMAIL_STORAGE_KEY = 'promopronto_login_email'; // Mantido para os links emitidos pela versão anterior.
const LINK_URL = `${location.origin}/acesso.html`;

function showMode(next, { keepStatus = false } = {}) {
  mode = next;
  panels.forEach(panel => { panel.hidden = panel.dataset.panel !== next; });
  $('panelTitle').textContent = viewTexts[next][0];
  $('panelDescription').textContent = viewTexts[next][1];
  if (!keepStatus) showStatus('');
}
function showStatus(message, type = '') {
  const el = $('status');
  el.textContent = message;
  el.className = `status${type ? ` ${type}` : ''}`;
}
function setBusy(form, busy) {
  form.querySelectorAll('button').forEach(btn => { btn.disabled = busy; });
  form.setAttribute('aria-busy', String(busy));
}
function normalizedEmail(value) { return value.trim().toLowerCase(); }
function clientError(error, kind = 'login') {
  const code = String(error?.code || '');
  if (['auth/invalid-email', 'auth/missing-email'].includes(code)) return 'Confira o endereço de e-mail informado.';
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-password'].includes(code))
    return 'E-mail ou senha incorretos. Se ainda não criou uma senha, entre com o link de acesso.';
  if (['auth/too-many-requests', 'auth/quota-exceeded'].includes(code)) return 'Muitas tentativas seguidas. Aguarde um pouco e tente novamente.';
  if (code === 'auth/user-disabled') return 'Esta conta está indisponível. Entre em contato com o suporte.';
  if (code === 'auth/network-request-failed' || error?.name === 'TypeError') return 'Sem conexão com o serviço. Verifique a internet e tente novamente.';
  if (code === 'auth/operation-not-allowed') return 'Esta forma de entrada precisa ser habilitada no Firebase. Contate o suporte.';
  if (['auth/expired-action-code', 'auth/invalid-action-code', 'auth/invalid-email-link'].includes(code)) return 'Este link expirou ou não é válido. Solicite outro link.';
  if (code === 'auth/weak-password') return 'Escolha uma senha mais forte, com pelo menos 10 caracteres.';
  if (code === 'auth/requires-recent-login') return 'Por segurança, confirme seu e-mail novamente pelo link e tente cadastrar a senha.';
  if (kind === 'reset') return 'Não foi possível solicitar a recuperação. Tente novamente em instantes.';
  if (kind === 'link') return 'Não foi possível enviar o link. Confira o e-mail e tente novamente.';
  return 'Não foi possível concluir a operação. Tente novamente.';
}
function copyEmailTo(target) {
  const value = ['loginEmail', 'linkEmail', 'resetEmail', 'confirmEmail'].map(id => $(id).value.trim()).find(Boolean);
  if (value && target) $(target).value = value;
}
function focusVisibleField() {
  const active = document.activeElement;
  if (!active || !active.matches?.('input') || !matchMedia('(max-width:768px)').matches) return;
  requestAnimationFrame(() => { if (document.activeElement === active) active.scrollIntoView({ behavior: 'auto', block: 'center' }); });
}
document.addEventListener('focusin', event => {
  if (!event.target.matches('input')) return;
  setTimeout(focusVisibleField, 120);
  setTimeout(focusVisibleField, 350);
});
window.visualViewport?.addEventListener('resize', focusVisibleField);
window.addEventListener('orientationchange', () => setTimeout(focusVisibleField, 150));
for (const button of document.querySelectorAll('[data-go]')) {
  button.addEventListener('click', () => { copyEmailTo({ login: 'loginEmail', link: 'linkEmail', reset: 'resetEmail' }[button.dataset.go]); showMode(button.dataset.go); });
}
for (const button of document.querySelectorAll('[data-password-toggle]')) {
  button.addEventListener('click', () => {
    const field = $(button.dataset.passwordToggle);
    field.type = field.type === 'password' ? 'text' : 'password';
    button.textContent = field.type === 'password' ? 'Mostrar' : 'Ocultar';
    button.setAttribute('aria-pressed', String(field.type === 'text'));
    button.setAttribute('aria-label', field.type === 'text' ? 'Ocultar senha' : 'Mostrar senha');
  });
}
function hideEditor() {
  stopMonitoring();
  editorOpen = false;
  currentUid = null;
  $('editorFrame').removeAttribute('srcdoc');
  $('editorFrame').hidden = true;
  $('loadingEditor').hidden = false;
  $('editorContainer').hidden = true;
  $('publicArea').hidden = false;
  $('runtimeWarning').hidden = true;
}
function showEditorLoading() {
  $('publicArea').hidden = true;
  $('editorContainer').hidden = false;
  $('editorFrame').hidden = true;
  $('loadingEditor').hidden = false;
}
function blockAccess(message) {
  hideEditor();
  $('blockedMessage').textContent = message;
  showMode('blocked');
}
function stopMonitoring() {
  if (pollHandle) clearInterval(pollHandle);
  pollHandle = null;
  healthCheck = null;
  failedChecks = 0;
}
async function requestEditor(user, method = 'GET', retryToken = true) {
  const token = await user.getIdToken();
  let response = await fetch('/api/editor', { method, headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', credentials: 'same-origin' });
  if (response.status === 401 && retryToken) {
    const fresh = await user.getIdToken(true);
    response = await fetch('/api/editor', { method, headers: { Authorization: `Bearer ${fresh}` }, cache: 'no-store', credentials: 'same-origin' });
  }
  return response;
}
function failureText(code) {
  if (code === 403) return 'Não encontramos uma compra ativa vinculada a esta conta. Se você acabou de pagar, aguarde a confirmação e tente novamente.';
  if (code === 401) return 'Sua sessão expirou. Entre novamente para continuar.';
  return 'Não conseguimos consultar sua compra agora. Verifique a conexão e tente novamente.';
}
async function denyAccess(statusCode) {
  if (statusCode === 401) {
    try { await firebase.signOut(auth); } catch { /* invalidação local ainda será tratada abaixo */ }
    pendingSetupUser = null;
    hideEditor();
    showMode('login');
    showStatus('Sua sessão expirou. Entre novamente para continuar.', 'error');
    return;
  }
  blockAccess(failureText(statusCode));
}
async function verifyPurchase(user) {
  if (!user.emailVerified) {
    blockAccess('Este e-mail ainda não foi confirmado. Entre usando o link enviado ao seu e-mail.');
    return false;
  }
  try {
    const response = await requestEditor(user, 'HEAD');
    if (response.ok) return true;
    await denyAccess(response.status);
    return false;
  } catch {
    blockAccess('Não foi possível conectar ao servidor de acesso. Confira a conexão e tente novamente.');
    return false;
  }
}
async function openEditor(user) {
  if (opening || (editorOpen && currentUid === user.uid)) return;
  opening = true;
  showEditorLoading();
  try {
    if (!user.emailVerified) {
      blockAccess('Seu e-mail ainda não foi confirmado. Use o link de acesso para confirmar a identidade.');
      return;
    }
    const response = await requestEditor(user, 'GET');
    if (!response.ok) { await denyAccess(response.status); return; }
    const html = await response.text();
    if (auth.currentUser?.uid !== user.uid) { hideEditor(); return; }
    $('editorFrame').srcdoc = html;
    $('editorFrame').hidden = false;
    $('loadingEditor').hidden = true;
    editorOpen = true;
    currentUid = user.uid;
    failedChecks = 0;
    startMonitoring();
  } catch {
    blockAccess('Não foi possível abrir o Studio. Verifique sua conexão e tente novamente.');
  } finally {
    opening = false;
  }
}
async function monitorAccess() {
  if (!editorOpen || !auth.currentUser || healthCheck || document.visibilityState === 'hidden') return;
  const user = auth.currentUser;
  healthCheck = (async () => {
    try {
      const response = await requestEditor(user, 'HEAD');
      if (!editorOpen || auth.currentUser?.uid !== user.uid) return;
      if (response.status === 401 || response.status === 403) {
        await denyAccess(response.status);
        return;
      }
      if (!response.ok) throw new Error('ACCESS_CHECK_UNAVAILABLE');
      failedChecks = 0;
      $('runtimeWarning').hidden = true;
    } catch {
      failedChecks++;
      if (failedChecks >= 2) {
        blockAccess('Não foi possível confirmar a autorização da sua sessão. Verifique a internet e toque em Tentar novamente.');
      } else {
        $('runtimeWarning').textContent = 'Conexão instável. Estamos tentando confirmar seu acesso.';
        $('runtimeWarning').hidden = false;
      }
    }
  })();
  try { await healthCheck; } finally { healthCheck = null; }
}
function startMonitoring() {
  stopMonitoring();
  pollHandle = setInterval(monitorAccess, 60_000);
}
window.addEventListener('focus', () => { if (editorOpen) monitorAccess(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && editorOpen) monitorAccess(); });

async function completeEmailLink(email) {
  const form = $('confirmLinkForm');
  setBusy(form, true);
  showMode('checking');
  resolvingLink = true;
  try {
    const result = await firebase.signInWithEmailLink(auth, normalizedEmail(email), location.href);
    try { localStorage.removeItem(EMAIL_STORAGE_KEY); } catch { /* armazenamento bloqueado */ }
    history.replaceState(null, '', LINK_URL); // Remove código de uso único do histórico/endereço.
    const user = result.user;
    const allowed = await verifyPurchase(user);
    if (!allowed) return;
    pendingSetupUser = user;
    showMode('setup');
  } catch (error) {
    showMode('confirmLink');
    showStatus(clientError(error, 'link'), 'error');
  } finally {
    resolvingLink = false;
    setBusy(form, false);
  }
}
async function initialize() {
  if (!validConfig) {
    showMode('login');
    showStatus('O serviço de acesso ainda não está configurado. Entre em contato com o suporte.', 'error');
    document.querySelectorAll('form button').forEach(button => { button.disabled = true; });
    return;
  }
  try {
    const [{ initializeApp }, authSdk] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js')
    ]);
    firebase = authSdk;
    auth = authSdk.getAuth(initializeApp(firebaseConfig));
    auth.languageCode = 'pt';
    try {
      await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
    } catch {
      // Safari privado pode bloquear persistência local. Não concedemos acesso sem Firebase.
      await authSdk.setPersistence(auth, authSdk.browserSessionPersistence);
      showStatus('Este navegador não permite manter a sessão após fechar. Use o modo normal para entrar automaticamente.', 'error');
    }
    const hasLink = authSdk.isSignInWithEmailLink(auth, location.href);
    resolvingLink = hasLink;
    authSdk.onAuthStateChanged(auth, user => {
      if (resolvingLink || pendingSetupUser || logoutProcessing) return;
      if (user) {
        if (editorOpen && user.uid === currentUid) return;
        openEditor(user);
      } else {
        hideEditor();
        if (mode === 'checking' || mode === 'blocked' || mode === 'setup') showMode('login');
      }
    }, () => { hideEditor(); showMode('login'); showStatus('Não conseguimos recuperar sua sessão. Tente entrar novamente.', 'error'); });
    if (hasLink) {
      let savedEmail = '';
      try { savedEmail = localStorage.getItem(EMAIL_STORAGE_KEY) || ''; } catch { /* bloqueado */ }
      if (savedEmail) await completeEmailLink(savedEmail);
      else showMode('confirmLink');
      resolvingLink = false;
    }
  } catch {
    showMode('login');
    showStatus('Não foi possível iniciar o acesso agora. Verifique a internet e recarregue a página.', 'error');
    document.querySelectorAll('form button').forEach(button => { button.disabled = true; });
  }
}

$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = $('loginForm');
  setBusy(form, true);
  showStatus('Confirmando seus dados…');
  try {
    await firebase.signInWithEmailAndPassword(auth, normalizedEmail($('loginEmail').value), $('loginPassword').value);
    $('loginPassword').value = '';
    // O observador de sessão valida a compra no servidor antes de abrir o editor.
  } catch (error) {
    showStatus(clientError(error), 'error');
  } finally { setBusy(form, false); }
});
$('linkForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = $('linkForm');
  setBusy(form, true);
  showStatus('Enviando seu link…');
  try {
    const email = normalizedEmail($('linkEmail').value);
    await firebase.sendSignInLinkToEmail(auth, email, { url: LINK_URL, handleCodeInApp: true });
    try { localStorage.setItem(EMAIL_STORAGE_KEY, email); } catch { /* permitido concluir em outro dispositivo digitando e-mail */ }
    showStatus('Se o endereço estiver correto, você receberá um link. Confira sua caixa de entrada e o spam.', 'success');
  } catch (error) { showStatus(clientError(error, 'link'), 'error'); }
  finally { setBusy(form, false); }
});
$('confirmLinkForm').addEventListener('submit', async event => {
  event.preventDefault();
  await completeEmailLink($('confirmEmail').value);
});
$('resetForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = $('resetForm');
  setBusy(form, true);
  showStatus('Solicitando recuperação…');
  try {
    await firebase.sendPasswordResetEmail(auth, normalizedEmail($('resetEmail').value));
    showStatus('Se houver uma conta associada, enviaremos as instruções de recuperação por e-mail.', 'success');
  } catch (error) { showStatus(clientError(error, 'reset'), 'error'); }
  finally { setBusy(form, false); }
});
$('setupForm').addEventListener('submit', async event => {
  event.preventDefault();
  const password = $('newPassword').value;
  if (password.length < 10 || password.length > 128) { showStatus('Crie uma senha com 10 a 128 caracteres.', 'error'); return; }
  if (password !== $('confirmPassword').value) { showStatus('As duas senhas precisam ser iguais.', 'error'); return; }
  const form = $('setupForm');
  setBusy(form, true);
  showStatus('Salvando sua senha…');
  try {
    const user = pendingSetupUser;
    if (!user || auth.currentUser?.uid !== user.uid) throw new Error('SESSION_CHANGED');
    // A senha só pode ser cadastrada após link validado + compra ativa confirmada pelo servidor.
    await firebase.updatePassword(user, password);
    $('newPassword').value = '';
    $('confirmPassword').value = '';
    pendingSetupUser = null;
    showStatus('Senha criada. Seu Studio está abrindo…', 'success');
    await openEditor(user);
  } catch (error) { showStatus(clientError(error, 'setup'), 'error'); }
  finally { setBusy(form, false); }
});
$('skipSetupBtn').addEventListener('click', async () => {
  const user = pendingSetupUser;
  pendingSetupUser = null;
  if (user) await openEditor(user);
});
$('retryAccessBtn').addEventListener('click', async () => {
  const user = auth?.currentUser;
  if (!user) { showMode('login'); return; }
  await openEditor(user);
});
$('otherAccountBtn').addEventListener('click', async () => {
  try { if (auth) await firebase.signOut(auth); } catch { showStatus('Não foi possível encerrar a sessão. Tente novamente.', 'error'); return; }
  pendingSetupUser = null;
  hideEditor();
  showMode('login');
});
window.addEventListener('message', async event => {
  if (event.origin !== location.origin || event.source !== $('editorFrame').contentWindow || event.data?.type !== 'PROMOPRONTO_LOGOUT_REQUEST' || logoutProcessing) return;
  if (!window.confirm('Sair da conta? Seu rascunho fica salvo neste dispositivo.')) return;
  logoutProcessing = true;
  try {
    await firebase.signOut(auth);
    pendingSetupUser = null;
    hideEditor();
    showMode('login');
    showStatus('Você saiu da conta com segurança.', 'success');
  } catch { showStatus('Não foi possível sair agora. Tente novamente.', 'error'); }
  finally { logoutProcessing = false; }
});
initialize();
