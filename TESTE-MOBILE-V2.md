# PromoPronto — checklist de validação mobile V2

Versão focada exclusivamente em mobile (até 768 px). O desktop existente foi mantido.

## Publicar com segurança

1. Descompacte a pasta `promopronto-main` e faça backup do repositório atual.
2. Crie no GitHub a branch `ux-mobile-v2`; **não substitua a `main` neste momento**.
3. Envie para a branch o conteúdo da pasta `promopronto-main`, preservando `_private/`, `api/`, `public/`, `tests/`, `package.json` e `vercel.json`.
4. Verifique o deploy de prévia do Vercel; o editor é servido por `/api/editor` após autenticação, não como URL pública.
5. Faça os testes abaixo no iPhone e no Android com um usuário de teste que possua acesso.
6. Somente após os testes, faça merge da branch para `main`.

## Testes manuais: iPhone — Safari iOS

- [ ] Abrir `/acesso.html` com a barra inferior visível: `Receber link de acesso` aparece inteiro, sem sobreposição.
- [ ] Focar e digitar no e-mail com o teclado aberto: botão acessível por rolagem, sem zoom automático.
- [ ] Efetuar login com link Firebase real e abrir o editor protegido.
- [ ] Ver primeira sequência de 3 dicas: Escolha modelo → toque no texto → Exportar. Encerrar com `Entendi` e confirmar que não reaparece no acesso seguinte.
- [ ] Usar menu `⋯` → `Ver dicas` para reabrir a sequência.
- [ ] Ver exatamente 4 abas na base: Modelos / Conteúdo / Estilo / Foto.
- [ ] Abrir Modelos: galeria de 2 colunas, modelo selecionado destacado.
- [ ] Tocar uma aba e confirmar altura média ~35%; puxar a alça para cima: ~60%; puxar para baixo ou tocar aba ativa: painel recolhido.
- [ ] Confirmar que o preview permanece visível e nítido nas três alturas, sem fundo escuro.
- [ ] Alternar Feed 4:5, Story 9:16 e Quadrado, sem distorcer a arte.
- [ ] Tocar em texto da arte: aparecem 6 ações rápidas, sem abrir o painel automaticamente.
- [ ] Usar ações rápidas Editar/Fonte/Cor/Tamanho/Duplicar/Ocultar e conferir mudanças corretas.
- [ ] Arrastar texto e foto de produto; tocar fora desmarca e recolhe painel.
- [ ] Estilo: fonte tem rolagem horizontal; alterar cor, peso, tamanho; controles avançados iniciam fechados.
- [ ] Foto: upload de fundo, produto e logotipo; remover, ajustar zoom, posição e formato da foto.
- [ ] Conteúdo: título, subtítulo, preço anterior, preço de oferta, CTA e condições editáveis; teclado decimal para preços.
- [ ] Preço anterior riscado permanece acima do atual em todos os formatos/modelos; testar textos longos e rodapé.
- [ ] Testar desfazer/refazer no cabeçalho, incluindo alteração de texto e cor.
- [ ] Abrir Exportar: PNG, vídeo, compartilhar e configuração de animação/duração.
- [ ] Testar prévia de animação e botão pequeno de pausa sobre a arte.
- [ ] Exportar PNG e confirmar arquivo salvo em Arquivos/Fotos conforme fluxo do Safari.
- [ ] Exportar MP4/WebM, se a versão do Safari permitir MediaRecorder/captureStream; se não, verificar aviso e PNG alternativo.
- [ ] Compartilhar via menu nativo de compartilhamento.
- [ ] Atualizar a página e conferir que rascunho e imagens persistiram no mesmo aparelho.
- [ ] Menu `⋯` → Sair: cancelar primeiro; confirmar depois; validar sessão encerrada e rascunho mantido.

## Testes manuais: Android — Chrome

Repetir o fluxo de iPhone, com atenção a: tecla de preço, interação por toque, arraste da alça com scroll interno, zoom/posição de imagens, exportar WebM ou MP4 quando suportado, arquivos baixados, compartilhamento Android e login com teclado/Gboard aberto.

## Validações automatizadas incluídas

- `npm test`: 19 testes Node de sintaxe, recursos, integração e segurança (incluindo os testes originais).
- Navegação funcional e inspeção visual em Chromium nas larguras 360, 390, 430, 768, 1024 e 1366 px.
- Gestos touch simulados via protocolo Chrome: abrir painel, arrastar alça para expandir e tocar em texto para abrir barra rápida.
- Testes de fluxo de troca de fonte, cor, cabeçalho desfazer/refazer, exportação PNG/JSON e mudança de formato.
- Capturas desktop em 1024 e 1366 px: visualmente idênticas à versão anterior após estabilização do salvamento.

## Limitações

Estes testes não substituem execução nativa em iPhone Safari e Android Chrome. Não foram testados neste ambiente o login com uma conta Firebase real, acesso vinculado à compra Kiwify, exportação de vídeo em hardware iOS/Android nem restauração de rascunhos de clientes já existentes. Modelos com textos antigos movidos manualmente podem precisar de revisão visual; o editor preserva as posições escolhidas pelo usuário.
