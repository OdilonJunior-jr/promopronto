# PromoPronto — validação mobile (Safari iOS)

## Como publicar com segurança

1. Faça backup do ZIP atual e do projeto editável (.json) de uma campanha real.
2. Substitua os arquivos do repositório por este pacote, preservando suas configurações no Vercel e Firebase.
3. Faça o deploy primeiro em um ambiente de prévia (Preview Deployment), sem trocar o domínio de produção.
4. Teste pelo endereço de prévia do Vercel em um iPhone real, autenticando-se com um comprador com acesso ativo.
5. Publique em produção somente depois dos testes abaixo.

## Checklist de teste no iPhone (Safari)

- [ ] Abrir `/acesso.html` com barras do Safari visíveis, teclado aberto e fechadas: botão **Receber link de acesso** deve ser alcançável sem ficar atrás da barra inferior.
- [ ] Entrar com o e-mail de comprador autorizado, abrir o link de autenticação, confirmar que o editor abre sem uma barra adicional de **Sair** no topo.
- [ ] Na tela principal com largura ~390 px, arte fica inteira visível; sem scroll horizontal nem segunda barra de ações.
- [ ] Trocar Feed 4:5 → Story 9:16 → Quadrado, confirmando dimensões corretas e canvas responsivo.
- [ ] Abrir **Texto**: painel compacto ~35%, preview visível sem escurecer/desfocar, abas fixas embaixo.
- [ ] Arrastar a alça para cima: painel ~60%, e depois para baixo: compacto/fechado; tocar fora do painel deve fechá-lo.
- [ ] Arrastar um texto e uma foto dentro da arte, sem a ação ser confundida com gesto de fechar o painel.
- [ ] Em **Texto**, editar uma camada, trocar fonte pelo carrossel, abrir seções de alinhamento, tamanho, curvatura e ajustes avançados.
- [ ] Em **Fotos**, adicionar fundo/produto/logotipo, regular enquadramento/moldura e exportar; confirmar que nenhum ajuste foi perdido.
- [ ] Em **Conteúdo**, trocar preços e conferir que o preço anterior riscado está acima do atual; ler o rodapé no PNG real, sem colisões no modelo padrão.
- [ ] Tocar **Histórico**: desfazer, refazer e restaurar; restauração deve solicitar confirmação.
- [ ] Tocar no ícone de **Exportar**: salvar PNG e projeto JSON; compartilhar quando o Web Share estiver disponível; testar vídeo animado conforme compatibilidade do Safari.
- [ ] Criar campanha, esperar o indicador de salvamento, fechar/reabrir Safari e verificar a restauração automática do rascunho no mesmo aparelho.
- [ ] Importar arquivo JSON de projeto anterior e conferir fontes, textos e posições.
- [ ] Abrir menu **⋯** → **Sair da conta**, selecionar **Cancelar** e confirmar que a sessão continua; repetir e selecionar **OK**, confirmar que a tela de login aparece.
- [ ] Repetir com fonte grande do iPhone, zoom de acessibilidade, modo horizontal, iPhone SE e um iPhone com barra de gestos.

## Limites da validação automatizada

Foram executados os testes Node e uma conferência visual/interativa no Chromium em larguras 320, 375, 390, 430, 700, 768 e 1366 px; isso não substitui Safari físico. Autenticação Firebase/Kiwify, entrega de link por e-mail, compartilhamento nativo do iOS, gravação MP4/WebM e persistência de rascunhos em um aparelho real precisam de validação pelo responsável pela conta. Layouts intencionalmente personalizados com camadas arrastadas podem apresentar colisões, porque a edição livre continua permitida.
