# PromoPronto Studio — GitHub → Vercel | Etapa 1

Este projeto foi preparado para **publicar primeiro o site na Vercel**, depois conectar **Firebase** (login/autorização) e por último **Kiwify** (checkout + liberação automática).

**Nesta etapa: site publicado, vendas desativadas, login desativado.** Não existe checkout ou liberação automática ainda.

## 1. Subir para GitHub

1. Extraia o ZIP no computador.
2. Crie um repositório **PRIVADO** no GitHub, por exemplo `promopronto-studio`.
3. Clique em **Add file → Upload files**.
4. Envie o **conteúdo extraído**, mantendo as pastas `public`, `api`, `_private` e `tests` e os arquivos da raiz. **NÃO envie o ZIP como se fosse um site.**
5. Confira se `vercel.json`, `package.json` e `public/index.html` estão na raiz do repositório.

> O repositório precisa ser **privado** porque `_private/editor.html` contém o código comercial da ferramenta. Não publique em um repositório público nem mova `_private` para `public`.

## 2. Subir para Vercel

1. Entre em <https://vercel.com/new>.
2. Importe o repositório GitHub `promopronto-studio`.
3. Em **Root Directory**, mantenha `./` (raiz).
4. Em **Framework Preset**, escolha **Other** caso não apareça automaticamente.
5. A configuração `vercel.json` já define `outputDirectory: public`. Não selecione `public` como Root Directory.
6. Clique **Deploy**.
7. Teste as páginas `/` e `/acesso.html` no domínio `.vercel.app` exibido.

**Importante sobre planos:** a Vercel restringe o plano Hobby a uso não comercial. Para comercializar o PromoPronto nessa hospedagem, consulte e contrate um plano compatível com uso comercial, como Pro. Na fase atual, o checkout permanece desativado.

## 3. O que deve acontecer na Etapa 1

- Página de vendas abre e apresenta o produto.
- Exemplos reais são exibidos, incluindo no celular.
- Sem checkout cadastrado, os botões levam à explicação, sem fingir uma compra.
- Página `/acesso.html` informa que o acesso está em configuração.
- A chamada `/api/editor` nega acesso (HTTP 503) sem credenciais: **não existe acesso público ao editor**.

## 4. Etapa 2 — Firebase (vamos fazer depois)

1. Criar projeto Firebase com Authentication (link por e-mail) e Firestore.
2. Na configuração Web do Firebase, copiar `apiKey`, `authDomain`, `projectId` e `appId` para `public/config.js`. São configurações **públicas**, não senhas.
3. Em Vercel → Settings → Environment Variables, adicionar **segredos do servidor** `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY`, obtidos de conta de serviço restrita. **Nunca no GitHub.**
4. Em Firebase Authentication → Settings → Authorized domains, cadastrar o domínio do site na Vercel; configurar entrada por link de e-mail.
5. Criar Firestore e ajustar regras de segurança. O servidor valida a compra ativa na coleção `entitlements`, por hash SHA-256 do e-mail em minúsculas.
6. Fazer redeploy e testar uma conta aprovada em ambiente controlado.

A infraestrutura do Firebase não será criada automaticamente apenas por publicar este ZIP.

## 5. Etapa 3 — Kiwify (vamos fazer depois)

1. Criar o produto na Kiwify e configurar pagamento.
2. Integrar webhook assinado no backend para registrar compras válidas e atualizar `entitlements` ao aprovar, estornar ou reembolsar.
3. Testar compra, cancelamento e reembolso reais ou de homologação (conforme disponibilidade da plataforma).
4. Adicionar a URL HTTPS exata do checkout em `public/config.js` → `checkoutUrl`.
5. Publicar novamente e conferir compra ponta a ponta antes de divulgar.

**Não coloque URL de pagamento nem tente vender antes de validar esse fluxo.**

## Arquivos importantes

| Caminho | Função |
|---|---|
| `public/index.html` | Página de vendas |
| `public/acesso.html` | Login dos compradores (só após Firebase) |
| `public/config.js` | Configuração pública de Firebase e checkout |
| `public/assets/` | Artes usadas na página |
| `_private/editor.html` | Editor pago — **não público** |
| `api/editor.js` | Libera editor somente após autenticação e compra ativa |
| `api/health.js` | Diagnóstico simples do servidor |
| `vercel.json` | Configuração da Vercel |
| `package.json` | Dependência servidor e testes |
| `.env.example` | Nomes de variáveis futuras, sem segredos |

## Testar localmente

Na pasta do projeto, rode `npm test` para validar as proteções básicas. Para prévia do site, use um servidor HTTP apontando para `public/`, por exemplo `python -m http.server 8080 --directory public`. Isso **não** substitui teste de deploy na Vercel nem a integração com serviços externos.
