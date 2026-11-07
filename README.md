# Nobi

Rede social de evolução pessoal. Stack: React (JS) + Node/Express + MongoDB.

## Comece por aqui
1. `DESIGN.md` — telas, fluxos, regras de produto e marca, modelo de dados. É a fonte da verdade.
2. `design/tokens.css` / `design/tokens.json` — cores, tipografia, espaço, raios, sombras e movimento.
3. `design/broto/Broto.jsx` — componente do mascote (`stage`, `golden`, `expression`, `arms`, `outlined`). `BrotoHead` para logo.
4. `design/broto/icon-*.svg` — ícone do app (só a cabeça) em 1024, 64, 40 e 24 px.
5. `design/telas/*.dc.html` — mockups de referência visual (formato do editor de design, não é código de produção).

## Prompt sugerido para o Claude Code
> Leia o DESIGN.md e os tokens em design/. Monte um app React (JS) com Vite e uma API Node/Express + MongoDB.
> Comece pelo design system (tokens.css + componentes base da seção 9) e pelo Broto.jsx, depois implemente as telas na ordem:
> Login → Feed → Registrar → Conquista → Metas → Criar objetivo → Perfil → Editar perfil → Configurações → Desafio → Desktop.
> Use as telas em design/telas só como referência visual. Siga as regras de produto da seção 8 à risca.

---

## Como rodar o app

Requisitos: Node 20+. Não precisa instalar MongoDB: sem `MONGODB_URI`, a API sobe um MongoDB embutido (só para desenvolvimento) e guarda os dados em `server/.data`.

```bash
npm install
npm run seed   # dados de demonstração (recusa rodar em banco externo, salvo SEED_ALLOW=sim)
npm run dev    # API em :4000 e app em http://localhost:5173
npm test       # regras de sequência, nível e Broto dourado
```

Conta de demonstração: `rafalima@nobi.dev` / `nobi1234` (também `marina`, `caionunes`, `juliaprado`, `teo` @nobi.dev).

### Estrutura
- `server/` — Express + Mongoose. Regras de sequência em `server/src/services/streaks.js` (funções puras, testadas), nível em `level.js`, conquistas em `achievements.js`, temporadas em `seasons.js`. O servidor calcula sequência, nível, Broto dourado e ranking; o cliente nunca envia esses valores.
- `web/` — React + Vite. `src/config.js` tem `APP_NAME` e os textos de marca. Design system em `src/styles/` (tokens + componentes da §9) e `src/components/ui.jsx`. O Broto é `src/components/Broto.jsx` (cópia de `design/broto/Broto.jsx`).

### Decisões tomadas na implementação
- **Postar é sempre escolha do momento:** o "Publicar no feed" do Registrar começa desligado; depois de um check-in pelo cartão, o app só oferece "Postar". O "Só eu" do mockup de Criar objetivo foi removido por contrariar a §8.1.
- **"Hoje" é o dia de quem usa:** o app envia data e hora locais; o servidor aceita até 1 dia de diferença.
- **Juntos:** o grupo conta o dia quando metade ou mais marca (arredondando para cima). Ver pendência da §13.
- **Broto dourado com meta semanal:** só a partir de 2 semanas seguidas (uma semana com 4 treinos não é "7 dias seguidos").
- **XP:** +10 por objetivo/dia (uma vez, mesmo desfazendo e refazendo), +30 por marco, +25 por conquista. Nível = 1 + XP/100; nunca regride.
- **Ranking da Disputa:** semana de segunda a domingo; 10 pts por dia feito, ou os pontos de cada tarefa quando o desafio tem checklist.
- **Notificações:** calculadas na hora, dentro do app (sem push ainda). O lembrete aparece uma vez por dia, depois do horário escolhido, só se faltar algo.
- **Tema escuro:** não estava no design; foi derivado dos tokens (a cor "Tinta" de objetivo vira cinza no escuro).

### Fotos
Foto de perfil e foto nos posts ficam no **Vercel Blob** (público), nunca no banco. O app reduz a imagem no aparelho (perfil 256 px, post até 1440 px) e o servidor confere os bytes (só JPG, PNG ou WebP). Em produção basta ligar um Blob Store (público) ao projeto na Vercel: os Blobs novos criam `BLOB_STORE_ID` e autenticam sozinhos (OIDC); os antigos usam `BLOB_READ_WRITE_TOKEN`. Em desenvolvimento, sem nenhum dos dois, as fotos vão para `server/.uploads`.

### Notificações push
Web Push com service worker (`web/public/sw.js`). Funciona no Android e no computador, e no iPhone (iOS 16.4+) só com o app adicionado à tela de início. Mensagens em `server/src/services/pushMessages.js`: variam com o contexto (sequência, véspera do Broto dourado, amigos que já fizeram, desafio) e nunca culpam. Avisos sociais não saem entre 22h e 8h e são agrupados.
- Variáveis na Vercel: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.
- Lembrete: o cron-job.org chama `GET /api/cron/reminders` a cada 15 min com `Authorization: Bearer <CRON_SECRET>`.

### Ainda não feito
- Login com Apple (precisa de conta de desenvolvedor Apple). O Google funciona ao preencher `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID`.
- Envio de e-mail para "Esqueci a senha": em desenvolvimento o link aparece no terminal da API.
- Criação de desafios com checklist pela interface (o "Foco Total" vem do seed).
