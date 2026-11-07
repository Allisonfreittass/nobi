# Nobi — Handoff de design

> Fonte da verdade para implementar o app. Leia antes de escrever qualquer tela.
> Stack alvo: **React (JS) + Node/Express + MongoDB**. Web responsiva (celular e PC).
> Arquivos deste pacote: `design/tokens.json`, `design/tokens.css`, `design/broto/` (mascote e ícone), `design/telas/` (mockups de referência, só visual).

---

## 1. Produto em uma frase

Rede social de evolução pessoal: a pessoa cria objetivos (treino, leitura, estudo, hábitos, projetos), registra o que fez, mantém sequências, participa de desafios e compartilha a evolução com amigos.

**Tese:** as pessoas continuam evoluindo quando acompanham, compartilham e celebram o progresso junto de outras pessoas.

## 2. Regras de identidade (decididas pelo fundador)

1. **Ícone inesquecível** — um personagem que funciona até em 60 × 60 px.
2. **Mascote proprietário** — personalidade, expressões e evolução.
3. **Interface premium** — tipografia, espaçamento, hierarquia e acabamento impecáveis.
4. **Microinterações** — tudo que o usuário faz tem feedback gostoso.
5. **Gamificação visual** — conquistas, níveis, temporadas e colecionáveis.
6. **Social first** — o feed precisa ser tão agradável quanto uma rede social.

Direção visual: **Playful Premium**. Divertido e expressivo, nunca infantil. A interface ao redor do mascote é sóbria — é ela que segura o "premium".

## 3. Nome e marca

- **Nome:** Nobi (do japonês 伸び, crescer/progredir). Wordmark: `Nobi.` com o ponto na cor Brasa.
- **Frase de marca:** "Evoluir fica melhor quando é junto."
- **Mascote:** Broto. O nome do mascote é independente do nome do app.
- **Registro:** INPI sem colisão exata para "NOBI" (busca em 06/11/2026). Atenção: pedido "NOBIU" na classe 42. Pedir nas classes 9, 41, 42 e 45. Nos EUA há "NOBI" registrado (NOBI NV) nas classes 9/42/45 → nome na loja deve ser composto, ex.: **"Nobi: evolua junto"**.
- **Código:** o nome do app fica em constante/config (`APP_NAME`), nunca espalhado em strings.

## 4. Cores (ver `design/tokens.json`)

| Token | Hex | Papel |
|---|---|---|
| `brasa` | `#FF5B2E` | Marca, ação principal, botão "+" |
| `orbita` | `#6C4DFF` | Desafios (cards, cabeçalhos, ranking) |
| `tinta` | `#141218` | Texto, botões escuros |
| `creme` | `#FFF1E4` | Corpo do mascote, pílulas suaves |
| `papel` | `#F7F5F0` | Fundo do app |
| `dourado` | `#FFB224` | **Exclusivo da sequência** (broto dourado, anel de amigo em sequência) |

**Cores de categoria** (só para identificar tipo de objetivo, sempre com rótulo): Treino `brasa`, Leitura `orbita`, Estudo `#2E9C6A`, Hábito `#3B82C4`, Objetivo `#E0457B`, Projeto `tinta`.

**Regras de contraste (medido, WCAG):**
- Nunca texto branco sobre `brasa` (3,1:1). Use `tinta` (6:1).
- Texto pequeno sobre `orbita` é branco (5,1:1), nunca lilás.
- Texto secundário: `#6B6872` ou `#4A4752` sobre fundos claros (≥ 5:1).
- `brasa` e `orbita` têm luminosidade parecida: nunca diferenciar dados só por essas duas cores.
- Dourado sobre coral precisa de contorno `tinta` (o broto dourado já tem).

## 5. Tipografia

- **Títulos, números, conquistas:** Bricolage Grotesque 700–800, tracking negativo (−0,02 a −0,04em).
- **Interface e texto corrido:** Inter 400–700.
- Escala em **rem** (`--nobi-text-*`): 4 / 2.5 / 1.875 / 1.75 / 1.375 / 1.25 / 1.125 / 1 / 0.9375 / 0.875 / 0.8125 / 0.75 rem (= 64…12 px na fonte padrão). Mínimo 0.75 rem. Nunca px em font-size.

## 6. Mascote Broto — sistema completo

Componente: `design/broto/Broto.jsx`. Um único componente para o app inteiro.

**Regras de uso:**
- **Dentro do app:** sempre de **corpo inteiro** (cabeça em gota, bracinhos, barriga clara, pernas curtas e pés tipo chinelo creme com contorno tinta, sombra elíptica separada).
- **Ícone e logo:** **só a cabeça**, cortada embaixo (`design/broto/icon-*.svg`). Sem braços, sem barriga.
- Exceção: no Registrar ele espia por trás da folha (pernas escondidas naturalmente).
- Corpo é sempre `creme`. Sobre fundo branco, usar a variante com contorno (`outlined`).
- Sempre sobre um bloco de cor da paleta ou com contorno.

**Duas regras independentes:**
- **Forma = nível (permanente, nunca regride):** `broto` (nível 1–9, 2 folhas) → `muda` (10–24, 3 folhas) → `botao` (25–49, botão de flor violeta) → `flor` (50+).
- **Cor = sequência (muda dia a dia):** folhas escuras por padrão; **douradas** quando a maior sequência ativa do usuário é ≥ 7 dias. Quando a sequência zera, volta ao escuro com a expressão `saudade` ("que bom te ver") — sem tristeza, sem aviso vermelho.

**Expressões:** `padrao`, `comemorando` (olhos fechados felizes, boca aberta, braços para cima), `foco` (sobrancelhas em arco suave — nunca inclinadas/bravas), `saudade` (olhos grandes com brilho duplo, boquinha "o", acenando).

**Props do componente:** `stage`, `golden`, `expression`, `arms` (`down` | `up` | `wave`), `outlined`, `shadow`, `size`.

**Derivação no código:**
```js
stage  = level >= 50 ? 'flor' : level >= 25 ? 'botao' : level >= 10 ? 'muda' : 'broto';
golden = maxActiveStreakDays(user) >= 7;
```

## 7. Navegação e telas

Barra inferior (celular): **Feed · Comunidade · Metas · Perfil** numa pílula flutuante + **[+] Registrar** separado (coral). "Comunidade" substitui o antigo "Explorar". No PC: menu lateral com os mesmos itens + botão "Registrar" + widget "Sessão de foco".

| Tela | Arquivo de referência | Conteúdo essencial |
|---|---|---|
| Login | `Login.dc.html` | Broto acenando, wordmark, Apple / Google / e-mail (usar botões oficiais das plataformas), criar conta, termos |
| Feed (Home) | `Feed.dc.html` | Amigos com anel, card do desafio ativo, posts com métricas (min, páginas, km, variação vs. mês), reações "Boa!" e comentários |
| Registrar | `Registrar.dc.html` | Folha: categoria, tempo (stepper ±5), nota, **Publicar no feed** (toggle) → se ligado, Amigos/Público |
| Conquista | `Conquista.dc.html` | Tela cheia coral, Broto comemorando e dourado, "7 dias seguidos!", semana Seg–Dom, Compartilhar / Agora não |
| Desafio | `Desafio.dc.html` | Cabeçalho violeta com temporada, progresso do desafio, checklist do dia com pontos, ranking semanal |
| Perfil | `Perfil.dc.html` | Editar/Configurações no topo, avatar com nível, selo de temporada, interesses, sequência/consistência/desafios, mapa do mês, conquistas |
| Metas | `Objetivos.dc.html` | Seletor **Hoje · Semana · Mês · Concluídas** (ver seção 8.1) |
| Criar objetivo | `NovoObjetivo.dc.html` | Nome, **Pessoal / Com amigos**, convidar amigos + Juntos/Disputa, tipo, dias, cor |
| Parabéns — novo hábito | `NovoHabito.dc.html` | Aparece logo após criar um objetivo. "Novo hábito plantado", Broto comemorando ao lado de um vaso com broto que cresce, "Começou!", card do objetivo com a semana (hoje destacado, dias de descanso explicados), toggle opcional "Contar para os amigos" (desligado por padrão), "Fazer o 1º check-in agora" / "Começar [próximo dia ativo]" |
| Editar perfil | `EditarPerfil.dc.html` | Foto, nome, @usuário (checagem), bio 120, interesses, estatísticas Amigos/Público |
| Configurações | `Configuracoes.dc.html` | Notificações, privacidade, tema, semana, animações do Broto, conta, sair, excluir |
| Desktop | `Desktop.dc.html` | Menu lateral, objetivos do dia, projeto com marcos, consistência 12 semanas, amigos e ranking |
| Comunidade | `Comunidade.dc.html` | Busca, seletor **Desafios · Clubes**. Clubes: "Seus clubes", "Perto de você" (cidade), por interesse, botão Entrar (tinta). Desafios: destaque da temporada + lista com Participar |
| Clube | `Clube.dc.html` | Cabeçalho na cor da categoria, membros e amigos dentro, Entrar/Membro, compartilhar, menu (regras, denunciar, sair). Abas **Feed · Desafios · Ranking · Membros**; post fixado; atalho para postar já como Público |

Fluxo principal: Feed → [+] → Registrar → (se fechou marco) Conquista → Feed.
Fluxo de novo objetivo: Metas → Novo → Criar objetivo → **Parabéns — novo hábito** → (check-in agora ou depois) → Metas.

Regras da comunidade (clubes):
- Só aparecem no clube os posts marcados como **Público** e da categoria do clube. Post de Amigos nunca vaza para clube.
- MVP: clubes **oficiais e curados** (por interesse e por cidade) + **grupos privados de amigos**. Clube criado por qualquer pessoa só depois que a moderação estiver madura.
- Moderação obrigatória desde o dia 1: denunciar post e pessoa, bloquear, regras fixadas, admins/moderadores, remover post, banir do clube.
- Ranking do clube é semanal e zera no domingo (mesma lógica do desafio). Desafio do clube usa o mesmo modelo de `goals` com `shared`.
- Entrar em clube não exige seguir ninguém; "Seguir" fica na lista de membros.

Regras da tela de parabéns: aparece **toda vez** que um objetivo é criado (é o pico de motivação); o texto e o card usam os dados reais do objetivo; se hoje não é dia ativo, o botão secundário diz "Começar [próximo dia ativo]"; nada é postado se o toggle ficar desligado; com amigos, mostrar quem foi convidado.

## 8. Regras de produto (não negociáveis)

1. **Postar é sempre opcional e decidido no momento.** Não existe "postar só para mim". Um objetivo nunca postado é simplesmente pessoal. Público dos posts: **Amigos** ou **Público**.
2. **Nada vai para o feed sozinho.** Ao registrar ou bater marco, o app oferece; o usuário decide.
3. **Sequência individual por objetivo**, com unidade do tipo: hábito = dias, meta semanal = semanas, projeto = dias em que avançou, contagem = dias em que bateu a meta.
4. **Dias de descanso** escolhidos no objetivo não quebram a sequência. Não fazer um objetivo não quebra os outros.
5. **Gamificação sem culpa:** sem vermelho de erro para sequência perdida; nível nunca regride.
6. **Objetivo com amigos e Desafio são o mesmo modelo de dados.** Desafio = objetivo compartilhado com duração definida e, opcionalmente, ranking.
   - **Juntos:** sem competição; sequência do grupo vale quando a maioria marca (não punir o grupo por uma pessoa).
   - **Disputa:** ranking semanal por pontos, zera no domingo.
   - Cada participante registra no próprio app; todos veem quem já fez hoje.
7. **Anel dos amigos no feed:** dourado = sequência ≥ 7 dias; brasa = postou hoje; cinza = não postou.
8. **Temporadas:** ciclos de ~12 semanas (ex.: "Temporada Primavera · sem. 3/12") com conquistas e acessórios colecionáveis próprios.
9. **Notificações respeitosas:** lembrete de check-in só se faltar algo no dia, um por dia, no horário escolhido.

### 8.1 Metas: visões por período (sem aba nova)

A aba Metas é a central de tudo que é do usuário. **Não existe aba "Foco" separada** (o nome "Foco" é da sessão de foco com timer).

- **Hoje**, nesta ordem:
  1. **3 prioridades de hoje** — card escuro; o usuário escolhe até 3 tarefas/itens do dia, cada um ligado a um objetivo (bolinha da cor da categoria). Check com "pulo".
  2. **Rotina** — não há construtor de rotina: são os **hábitos que têm horário opcional**, ordenados por horário (linha do tempo com cor da categoria, pílula de sequência, check).
  3. **Ficou pra trás** — **só tarefas com data vencida** (hábito nunca "atrasa"). Visual neutro, sem vermelho, texto "sem pressa, decide aqui", ações **Fazer hoje** / **Reagendar** (e remover).
  4. **Objetivos** — % concluído, **dias restantes**, barra com **marcador de ritmo** (onde deveria estar hoje) e status "No ritmo" ou "Um pouco atrás do ritmo · N pts" (nunca "atrasado").
- **Semana** — hábitos cumpridos no período (x/y + barras por dia, descanso em cinza) e tarefas da semana agrupadas por objetivo.
- **Mês** — % de hábitos no mês, tarefas feitas, marcos batidos e o que vence até o fim do mês.
- **Concluídas** — histórico do período; marcos de projeto podem virar post (botão **Postar**, opcional).

Ritmo esperado: `pacePct = (hoje - inicio) / (prazo - inicio) * 100`. "No ritmo" se `pct >= pacePct`.

Fora do MVP (decidido): integração com Google Agenda, construtor de rotina separado, aba "Foco".

### 8.2 Checklist de projeto

- Ao criar um objetivo do tipo **Projeto**, a seção de dias dá lugar a **Etapas do projeto** + **Prazo**.
- **Dois níveis no máximo:** etapa → subetapa. Nada de sub-sub-itens (não virar gestor de tarefas).
- Cada etapa pode ter data e ser marcada como **Marco**. Concluir um marco dispara comemoração e oferece post (opcional).
- **Progresso do projeto** = itens concluídos / total, contando subetapas; etapa com subetapas conta como concluída quando todas as subetapas estão concluídas.
- Etapas e subetapas são `tasks` (aparecem nas visões Hoje/Semana/Mês quando têm data, e podem ser escolhidas como prioridade do dia).
- Reordenar por arrastar (alça à esquerda); adicionar etapa pelo campo no fim da lista; "+ subetapa" em cada etapa.

## 8.3 Nativo é o piso, a marca é o teto

Referência: "Native is a floor, not a ceiling" (Mathieu Poli, UX Collective). Prancha no canvas: **Jeito nativo — antes e depois**.

Os mockups em `design/telas/` desenham controles à mão (barra de abas, folhas, toggles, seletores, alertas). **No código, isso não deve ser redesenhado como imagem.** Divisão do esforço:

**Fica com o sistema / navegador (não redesenhar):**
| Elemento | Implementação |
|---|---|
| Voltar | Cada tela **e cada folha** tem rota própria (react-router) → botão voltar do Android e gesto do navegador funcionam |
| Folhas (Registrar, convites) | Folha **destacada das bordas** (8 px de margem, raio 34, alça no topo), fecha com arrastar, X, Esc e voltar. Base: `<dialog>` com foco preso e `aria-modal` |
| Confirmações (excluir conta, remover objetivo) | `<dialog>` nativo, botões reais |
| Compartilhar | `navigator.share()` (abre a folha do celular); fallback copiar link |
| Datas e horários (prazo, etapas, lembrete) | `<input type="date">` / `type="time"` |
| Escolha de opção ("Para quem", tempo) | Linha de lista que abre `<select>` / seletor numérico nativo |
| Switches | `<input type="checkbox" role="switch">` estilizado; **ligado = tinta**, não coral |
| Texto | `rem` em tudo (tokens `--nobi-text-*`) → cresce com a fonte do sistema. Nunca px em font-size |
| Barra de abas | Pílula **flutuante** destacada da borda, aba ativa marcada, "+" separado ao lado, `env(safe-area-inset-bottom)` |
| Preferências do sistema | `prefers-reduced-motion`, `prefers-color-scheme`, foco visível no teclado |

**Fica com a marca (aqui gastar identidade):** Broto, telas de celebração (Conquista, Parabéns novo hábito), títulos em Bricolage, cards de métricas do feed, tom do texto, microinterações de check-in, ícone.

**Regra do coral:** **um coral por tela** — a ação principal (e o "+"). Switches, seleção, chips e abas usam tinta/neutros. As celebrações podem usar fundo coral inteiro.

Se um dia virar React Native: usar tab bar, sheets, alerts, switches e haptics do sistema; o visual Nobi fica no conteúdo.

## 9. Componentes base

- **Card:** fundo branco, raio 24, sombra `0 1px 0 #E9E5DC`, padding 16.
- **Botão primário:** `brasa`, texto `tinta` 700, altura 56–58, raio 18–20, `inset 0 -4px 0 rgba(0,0,0,.12)`.
- **Botão escuro:** `tinta`, texto branco, raio 16–22.
- **Chip/filtro:** altura 44 (área de toque), raio 22; selecionado = `tinta` com texto branco.
- **Toggle:** switch do sistema (`role="switch"`), 50 × 30, ligado = `tinta` (ver 8.3), bolinha branca.
- **Controle segmentado:** trilho `papel`, opção ativa branca com sombra leve, altura 40.
- **Pílula de sequência:** ícone de chama + número; ativa = fundo `creme`, texto `#B83A12`.
- **Áreas de toque:** mínimo **44 × 44 px** em tudo que é clicável.
- Ícones: traço 2–2,4 px, cantos arredondados, sem emoji.

## 10. Microinterações

- Check-in: botão vira estado "feito", chama acende, número da sequência dá um "pulo" (`scale 1 → 1.18 → 1`, 420 ms, `cubic-bezier(.3,.7,.4,1.4)`), barra enche (300 ms), quadradinho do dia preenche.
- Conquista: Broto pula em loop (1,6 s), título entra com "pop" (600 ms).
- Toggle: 160 ms. Seleções: 140 ms.
- **Respeitar `prefers-reduced-motion`** e a opção "Animações do Broto" nas configurações.

## 11. Modelo de dados sugerido (MongoDB)

```js
// users
{ _id, name, username, bio, avatarUrl, interests: [String],
  level: Number, xp: Number,
  privacy: { profile: 'friends'|'public', approveFollowers: Boolean, stats: 'friends'|'public' },
  prefs: { theme: 'light'|'dark'|'system', weekStart: 'mon', mascotMotion: Boolean,
           reminderTime: '20:00', notify: { checkin, social, challenges } },
  createdAt }

// goals  (objetivo pessoal OU compartilhado/desafio — mesmo modelo)
{ _id, ownerId, title, category: 'treino'|'leitura'|'estudo'|'habito'|'projeto'|'objetivo',
  kind: 'daily'|'weekly'|'count'|'project',
  target: { amount, unit },          // ex.: 8 copos, 20 min, 4 treinos/semana
  activeDays: [0..6], color,
  shared: null | { mode: 'together'|'versus', participants: [userId],
                   startsAt, endsAt, seasonId },   // com endsAt = desafio
  startsAt, dueAt,                    // para % de ritmo e "dias restantes"
  scheduleTime: null | 'HH:MM',       // hábito com horário → aparece na Rotina
  createdAt, archivedAt }

// tasks  (substitui milestones: marco de projeto = tarefa com isMilestone)
// Checklist do projeto: etapa (parentId null) e subetapa (parentId = id da etapa). MÁXIMO 2 NÍVEIS.
{ _id, userId, goalId, parentId: ObjectId | null, title, dueDate: 'YYYY-MM-DD' | null, isMilestone: Boolean,
  priorityDate: 'YYYY-MM-DD' | null,  // escolhida como uma das 3 prioridades nesse dia (máx. 3 por dia)
  order: Number, doneAt: Date | null, createdAt }

// checkins
{ _id, goalId, userId, date: 'YYYY-MM-DD', value: Number, note, createdAt }

// streaks (cache derivado de checkins; recalcular no servidor)
{ goalId, userId, current, best, unit: 'days'|'weeks', lastDate }

// posts (só existem se o usuário escolheu postar)
{ _id, userId, goalId, checkinId, audience: 'friends'|'public',
  metrics: { minutes, pages, km, deltaVsLastMonth }, text, kind: 'checkin'|'milestone'|'record',
  reactions: [{ userId, type: 'boa' }], commentsCount, createdAt }

// follows
{ followerId, followeeId, status: 'pending'|'accepted', createdAt }

// clubs
{ _id, name, slug, category, city, kind: 'official'|'private', description, rules,
  pinnedPostId, membersCount, createdBy, createdAt }

// memberships
{ clubId, userId, role: 'member'|'moderator'|'admin', status: 'active'|'banned', joinedAt }

// reports
{ _id, reporterId, targetType: 'post'|'user'|'comment', targetId, clubId, reason, status: 'open'|'done', createdAt }

// posts ganha: clubIds: [ObjectId]  (só preenchido quando audience = 'public')

// seasons / achievements
{ _id, name, startsAt, endsAt }
{ _id, userId, code, seasonId, earnedAt }
```

Índices úteis: `tasks {userId, dueDate}`, `tasks {userId, priorityDate}`, `checkins {userId, date}`, `checkins {goalId, date}` único por usuário/dia, `posts {createdAt: -1}`, `follows {followerId, followeeId}` único, `memberships {clubId, userId}` único, `posts {clubIds, createdAt: -1}`, `clubs {city, category}`.

**O servidor calcula** sequência, nível, `golden` e ranking. O cliente nunca envia esses valores.

## 12. Acessibilidade

- Elementos reais: `<button>`, `<a href>`, `<input>` com `<label>`. Nunca `onClick` em `div`.
- `aria-label` em botões só com ícone; `aria-pressed` em toggles e chips.
- SVG decorativo com `aria-hidden="true"`; ícone do app com `role="img"` e `aria-label`.
- Contraste conforme a seção 4. Texto mínimo 12 px.

## 13. Pendências

- Validar com usuários: lembrança do ícone, percepção de "premium" vs. "infantil".
- Tipografia final e animações ainda não foram testadas em dispositivo.
- Definir nomes e arte das temporadas e dos colecionáveis.
- Sequência do grupo no modo "Juntos": confirmar a regra da maioria.
