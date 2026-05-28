# ⚡ PulseDesk — Sistema de Pesquisa de Satisfação com IA

Sistema completo de pesquisa de satisfação de atendimento com análise de sentimento por IA, painel admin e painel do funcionário.

---

## 🚀 Instalação Rápida

### 1. Instalar dependências
```bash
cd pulsedesk
npm install
```

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env
```
Edite o `.env` e preencha:
- `JWT_SECRET` — qualquer string longa e aleatória
- `ANTHROPIC_API_KEY` — sua chave da API da Anthropic (https://console.anthropic.com)
- `BASE_URL` — URL do seu servidor (ex: `http://localhost:3000`)

### 3. Rodar o servidor
```bash
npm start
# ou em desenvolvimento:
npm run dev
```

### 4. Acessar o sistema
| Tela | URL |
|------|-----|
| Login | http://localhost:3000 |
| Pesquisa pública | http://localhost:3000/pesquisa.html |
| Painel Admin | http://localhost:3000/admin.html |
| Painel Funcionário | http://localhost:3000/funcionario.html |

---

## 🔑 Credenciais Padrão

| Usuário | Email | Senha |
|---------|-------|-------|
| Admin | admin@pulsedesk.com | admin123 |
| Ana Silva | ana@empresa.com | senha123 |
| Carlos Mendes | carlos@empresa.com | senha123 |
| Beatriz Costa | beatriz@empresa.com | senha123 |
| Diego Rocha | diego@empresa.com | senha123 |
| Diego Rocha | diego@empresa.com | senha123 |

---

## 🏗️ Estrutura do Projeto

```
pulsedesk/
├── server.js              # Servidor principal Node.js
├── database.js            # Banco SQLite + seed inicial
├── .env.example           # Template de configuração
├── package.json
│
├── routes/
│   ├── auth.js            # Login admin e funcionário
│   ├── pesquisa.js        # Rotas públicas da pesquisa
│   ├── admin.js           # Rotas do painel admin
│   └── funcionario.js     # Rotas do painel funcionário
│
├── services/
│   └── ia.js              # Integração com API Claude (Anthropic)
│
├── middleware/
│   └── auth.js            # Validação JWT
│
└── public/
    ├── login.html         # Tela de login
    ├── pesquisa.html      # Pesquisa pública (link/QR Code)
    ├── admin.html         # Painel do administrador
    └── funcionario.html   # Painel do funcionário
```

---

## ✨ Funcionalidades

### Pesquisa Pública
- Avaliação por estrelas em 3 categorias (Cordialidade, Agilidade, Resolução)
- Campo de comentário livre
- Acesso via link direto ou QR Code por funcionário
- Feedback visual do sentimento detectado pela IA

### Painel Administrador
- **Dashboard** com métricas em tempo real via Socket.io
- **Ranking** de atendentes com score ponderado
- **Gráfico** de avaliações dos últimos 7 dias
- **Donut** de sentimentos (positivo/neutro/negativo)
- **Tags** mais frequentes nos feedbacks
- **Alertas** em tempo real para feedbacks críticos
- **QR Code** gerado por funcionário (baixar PNG)
- **Gestão de funcionários** (cadastrar, ativar/desativar)
- **Filtros** nas pesquisas (sentimento, período)
- **Resumo executivo semanal** gerado pela IA ✨
- **Toast** em tempo real a cada nova avaliação

### Painel do Funcionário
- **Hero** com posição no ranking e frase motivacional gerada por IA ✨
- **Gráfico** de evolução da nota ao longo do tempo
- **Barras** de desempenho por categoria
- **Nuvem de tags** com o que os clientes falam dele
- **Histórico** completo com análise de IA por avaliação
- **Ranking** da equipe (sem comentários privados)
- Indicador de **tendência** (subindo/caindo vs semana anterior)

### IA (Anthropic Claude)
- **Análise de sentimento**: positivo / neutro / negativo
- **Resumo** de 1 linha do comentário do cliente
- **Tags automáticas**: cordialidade, agilidade, tempo-espera, etc.
- **Score ajustado**: considera tom do texto além da nota numérica
- **Alerta automático**: detecta feedbacks críticos
- **Resumo executivo semanal**: análise completa da equipe
- **Frase motivacional** personalizada por funcionário
- **Fallback inteligente**: se a chave de API não estiver configurada, usa análise por palavras-chave

---

## 🗄️ Banco de Dados (SQLite)

```sql
funcionarios    -- Dados dos atendentes + token de pesquisa único
pesquisas       -- Avaliações + análise da IA (sentimento, tags, score)
alertas         -- Feedbacks críticos para notificação
admins          -- Administradores do sistema
```

---

## 🔌 API Endpoints

### Públicos
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/auth/admin/login | Login admin |
| POST | /api/auth/funcionario/login | Login funcionário |
| GET | /api/pesquisa/funcionario/:token | Buscar funcionário pelo token do QR |
| GET | /api/pesquisa/funcionarios | Listar funcionários ativos |
| POST | /api/pesquisa/enviar | Enviar avaliação |

### Admin (JWT required)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/admin/dashboard | Dados do dashboard |
| GET | /api/admin/funcionarios | Listar com stats |
| POST | /api/admin/funcionarios | Criar funcionário |
| PUT | /api/admin/funcionarios/:id | Atualizar funcionário |
| GET | /api/admin/funcionarios/:id/qrcode | Gerar QR Code |
| GET | /api/admin/pesquisas | Listar pesquisas com filtros |
| PUT | /api/admin/alertas/:id/lido | Marcar alerta como lido |
| GET | /api/admin/resumo-semanal | Resumo IA da semana |

### Funcionário (JWT required)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/funcionario/meu-painel | Dados completos do painel |
| GET | /api/funcionario/ranking | Ranking da equipe |

---

## 🛠️ Produção

Para usar em produção:
1. Use `pm2` para manter o servidor rodando: `pm2 start server.js --name pulsedesk`
2. Configure um proxy reverso (nginx) para a porta 3000
3. Certifique-se de trocar `JWT_SECRET` por uma string forte
4. Atualize `BASE_URL` para o domínio real

---

## 📦 Dependências

| Pacote | Uso |
|--------|-----|
| express | Servidor HTTP |
| better-sqlite3 | Banco de dados SQLite |
| bcryptjs | Hash de senhas |
| jsonwebtoken | Autenticação JWT |
| socket.io | Tempo real |
| qrcode | Geração de QR Code |
| node-fetch | Chamadas à API Anthropic |
| dotenv | Variáveis de ambiente |
