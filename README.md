# ⚡ PulseDesk

Sistema de pesquisa de satisfação de atendimento com **análise de sentimento por IA**. O cliente responde à pesquisa (por link ou QR Code), a IA classifica o comentário e os resultados aparecem em painéis para o administrador e para o funcionário.

## Stack
Node.js · Express · SQLite · JWT · API da Anthropic (Claude) · HTML/CSS/JS · Vercel

## Funcionalidades
- Login com JWT e perfis (admin e funcionário)
- Pesquisa pública com geração de QR Code
- Análise de sentimento dos comentários com IA
- Painel admin com métricas da equipe e painel individual do funcionário

## Estrutura
```
routes/      -> auth, admin, funcionario, pesquisa
middleware/  -> autenticação JWT
database.js  -> SQLite + seed inicial
public/      -> telas (login, admin, funcionário, pesquisa)
```

## Como rodar
```bash
npm install
cp .env.example .env   # JWT_SECRET, ANTHROPIC_API_KEY, BASE_URL
npm run dev            # http://localhost:3000
```
O banco é criado e populado com usuários de exemplo na primeira execução (veja `database.js`).
