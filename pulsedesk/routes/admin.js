const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const { authMiddleware } = require('../middleware/auth');
const { gerarResumoSemanal } = require('../services/ia');

// Todas as rotas protegidas
router.use(authMiddleware('admin'));

// Dashboard - estatísticas gerais
router.get('/dashboard', async (req, res) => {
  const hoje = new Date();
  const seteDiasAtras = new Date(hoje - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const trintaDiasAtras = new Date(hoje - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const totalPesquisas = (await db.prepare('SELECT COUNT(*) as total FROM pesquisas').get()).total;
  const pesquisasHoje = (await db.prepare("SELECT COUNT(*) as total FROM pesquisas WHERE DATE(criado_em) = DATE('now', 'localtime')").get()).total;
  const mediaGeral = (await db.prepare('SELECT ROUND(AVG(nota_geral), 2) as media FROM pesquisas').get()).media || 0;
  const alertasNaoLidos = (await db.prepare('SELECT COUNT(*) as total FROM alertas WHERE lido = 0').get()).total;

  // Distribuição de sentimentos
  const sentimentos = await db.prepare(`
    SELECT sentimento, COUNT(*) as total 
    FROM pesquisas 
    GROUP BY sentimento
  `).all();

  // Top 5 funcionários por média
  const topFuncionarios = await db.prepare(`
    SELECT f.nome, f.setor, f.cargo,
           ROUND(AVG(p.nota_geral), 2) as media,
           COUNT(p.id) as total_avaliacoes,
           SUM(CASE WHEN p.sentimento = 'positivo' THEN 1 ELSE 0 END) as positivos
    FROM funcionarios f
    LEFT JOIN pesquisas p ON f.id = p.funcionario_id
    WHERE f.ativo = 1
    GROUP BY f.id
    ORDER BY media DESC
    LIMIT 10
  `).all();

  // Pesquisas por dia (últimos 7 dias)
  const pesquisasPorDia = await db.prepare(`
    SELECT DATE(criado_em) as dia, 
           COUNT(*) as total,
           ROUND(AVG(nota_geral), 2) as media
    FROM pesquisas 
    WHERE criado_em >= ?
    GROUP BY DATE(criado_em)
    ORDER BY dia
  `).all(seteDiasAtras);

  // Alertas recentes não lidos
  const alertasRecentes = await db.prepare(`
    SELECT a.*, f.nome as funcionario_nome, p.nota_geral, p.comentario, p.sentimento
    FROM alertas a
    JOIN funcionarios f ON a.funcionario_id = f.id
    JOIN pesquisas p ON a.pesquisa_id = p.id
    WHERE a.lido = 0
    ORDER BY a.criado_em DESC
    LIMIT 10
  `).all();

  // Tags mais frequentes (último mês)
  const todasTags = await db.prepare(`
    SELECT tags_ia FROM pesquisas 
    WHERE criado_em >= ? AND tags_ia != '[]'
  `).all(trintaDiasAtras);

  const contadorTags = {};
  todasTags.forEach(row => {
    try {
      const tags = JSON.parse(row.tags_ia);
      tags.forEach(tag => {
        contadorTags[tag] = (contadorTags[tag] || 0) + 1;
      });
    } catch (e) {}
  });
  const topTags = Object.entries(contadorTags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  res.json({
    totalPesquisas,
    pesquisasHoje,
    mediaGeral,
    alertasNaoLidos,
    sentimentos,
    topFuncionarios,
    pesquisasPorDia,
    alertasRecentes,
    topTags
  });
});

// Listar todos os funcionários com stats
router.get('/funcionarios', async (req, res) => {
  const funcionarios = await db.prepare(`
    SELECT f.*,
           COUNT(p.id) as total_avaliacoes,
           ROUND(AVG(p.nota_geral), 2) as media_geral,
           ROUND(AVG(p.nota_cordialidade), 2) as media_cordialidade,
           ROUND(AVG(p.nota_agilidade), 2) as media_agilidade,
           ROUND(AVG(p.nota_resolucao), 2) as media_resolucao,
           SUM(CASE WHEN p.sentimento = 'positivo' THEN 1 ELSE 0 END) as positivos,
           SUM(CASE WHEN p.sentimento = 'negativo' THEN 1 ELSE 0 END) as negativos,
           SUM(CASE WHEN p.alerta = 1 THEN 1 ELSE 0 END) as alertas_total
    FROM funcionarios f
    LEFT JOIN pesquisas p ON f.id = p.funcionario_id
    GROUP BY f.id
    ORDER BY media_geral DESC NULLS LAST
  `).all();

  res.json(funcionarios);
});

// Detalhes de um funcionário
router.get('/funcionarios/:id', async (req, res) => {
  const func = await db.prepare(`
    SELECT f.*,
           COUNT(p.id) as total_avaliacoes,
           ROUND(AVG(p.nota_geral), 2) as media_geral
    FROM funcionarios f
    LEFT JOIN pesquisas p ON f.id = p.funcionario_id
    WHERE f.id = ?
    GROUP BY f.id
  `).get(req.params.id);

  if (!func) return res.status(404).json({ erro: 'Funcionário não encontrado' });

  const pesquisas = await db.prepare(`
    SELECT * FROM pesquisas 
    WHERE funcionario_id = ?
    ORDER BY criado_em DESC
    LIMIT 50
  `).all(req.params.id);

  const evolucao = await db.prepare(`
    SELECT DATE(criado_em) as dia, ROUND(AVG(nota_geral), 2) as media, COUNT(*) as total
    FROM pesquisas WHERE funcionario_id = ?
    GROUP BY DATE(criado_em)
    ORDER BY dia
  `).all(req.params.id);

  res.json({ funcionario: func, pesquisas, evolucao });
});

// Criar funcionário
router.post('/funcionarios', async (req, res) => {
  const { nome, email, senha, setor, cargo } = req.body;
  if (!nome || !email || !senha || !setor) {
    return res.status(400).json({ erro: 'Nome, email, senha e setor são obrigatórios' });
  }

  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const hash = bcrypt.hashSync(senha, 10);

  try {
    const result = await db.prepare(`
      INSERT INTO funcionarios (nome, email, senha_hash, setor, cargo, token_pesquisa)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(nome, email, hash, setor, cargo || 'Atendente', token);

    res.json({ sucesso: true, id: result.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ erro: 'Email já cadastrado' });
    }
    res.status(500).json({ erro: 'Erro ao criar funcionário' });
  }
});

// Atualizar funcionário
router.put('/funcionarios/:id', async (req, res) => {
  const { nome, setor, cargo, ativo } = req.body;
  await db.prepare(`
    UPDATE funcionarios SET nome = ?, setor = ?, cargo = ?, ativo = ?
    WHERE id = ?
  `).run(nome, setor, cargo, ativo, req.params.id);
  res.json({ sucesso: true });
});

// Gerar QR Code do funcionário
router.get('/funcionarios/:id/qrcode', async (req, res) => {
  const func = await db.prepare('SELECT token_pesquisa, nome FROM funcionarios WHERE id = ?').get(req.params.id);
  if (!func) return res.status(404).json({ erro: 'Funcionário não encontrado' });

  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const url = `${baseUrl}/pesquisa.html?token=${func.token_pesquisa}`;

  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 400,
    margin: 2,
    color: { dark: '#1a1a2e', light: '#ffffff' }
  });

  res.json({ qr: qrDataUrl, url, nome: func.nome });
});

// Pesquisas com filtros
router.get('/pesquisas', async (req, res) => {
  const { funcionario_id, sentimento, de, ate, limite = 50 } = req.query;
  
  let query = `
    SELECT p.*, f.nome as funcionario_nome, f.setor
    FROM pesquisas p
    JOIN funcionarios f ON p.funcionario_id = f.id
    WHERE 1=1
  `;
  const params = [];

  if (funcionario_id) { query += ' AND p.funcionario_id = ?'; params.push(funcionario_id); }
  if (sentimento) { query += ' AND p.sentimento = ?'; params.push(sentimento); }
  if (de) { query += ' AND DATE(p.criado_em) >= ?'; params.push(de); }
  if (ate) { query += ' AND DATE(p.criado_em) <= ?'; params.push(ate); }

  query += ' ORDER BY p.criado_em DESC LIMIT ?';
  params.push(+limite);

  const pesquisas = await db.prepare(query).all(...params);
  res.json(pesquisas);
});

// Marcar alerta como lido
router.put('/alertas/:id/lido', async (req, res) => {
  await db.prepare('UPDATE alertas SET lido = 1 WHERE id = ?').run(req.params.id);
  res.json({ sucesso: true });
});

// Marcar todos alertas como lidos
router.put('/alertas/todos/lido', async (req, res) => {
  await db.prepare('UPDATE alertas SET lido = 1 WHERE lido = 0').run();
  res.json({ sucesso: true });
});

// Resumo semanal com IA
router.get('/resumo-semanal', async (req, res) => {
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const stats = await db.prepare(`
    SELECT COUNT(*) as total, ROUND(AVG(nota_geral), 2) as media
    FROM pesquisas WHERE criado_em >= ?
  `).get(seteDiasAtras);

  const melhor = await db.prepare(`
    SELECT f.nome, ROUND(AVG(p.nota_geral), 2) as media
    FROM pesquisas p JOIN funcionarios f ON p.funcionario_id = f.id
    WHERE p.criado_em >= ?
    GROUP BY p.funcionario_id ORDER BY media DESC LIMIT 1
  `).get(seteDiasAtras);

  const pior = await db.prepare(`
    SELECT f.nome, COUNT(*) as alertas
    FROM alertas a JOIN funcionarios f ON a.funcionario_id = f.id
    WHERE a.criado_em >= ?
    GROUP BY a.funcionario_id ORDER BY alertas DESC LIMIT 1
  `).get(seteDiasAtras);

  const alertasSemana = (await db.prepare(`
    SELECT COUNT(*) as total FROM alertas WHERE criado_em >= ?
  `).get(seteDiasAtras)).total;

  const todasTags = await db.prepare(`
    SELECT tags_ia FROM pesquisas WHERE criado_em >= ? AND tags_ia != '[]'
  `).all(seteDiasAtras);

  const contadorTags = {};
  todasTags.forEach(row => {
    try { JSON.parse(row.tags_ia).forEach(t => { contadorTags[t] = (contadorTags[t] || 0) + 1; }); } catch (e) {}
  });
  const topTags = Object.entries(contadorTags).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);

  const resumo = await gerarResumoSemanal({
    totalPesquisas: stats.total,
    mediaGeral: stats.media,
    melhorFuncionario: melhor?.nome || 'N/A',
    piorFuncionario: pior?.nome || null,
    topTags,
    alertasSemana
  });

  res.json({ resumo, stats, melhor, pior, alertasSemana, topTags });
});

module.exports = router;
