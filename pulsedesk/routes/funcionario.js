const express = require('express');
const router = express.Router();
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { gerarFraseMotivacional } = require('../services/ia');

router.use(authMiddleware('funcionario'));

// Meu painel - dados do funcionário logado
router.get('/meu-painel', async (req, res) => {
  const id = req.usuario.id;

  const func = await db.prepare('SELECT id, nome, setor, cargo, email FROM funcionarios WHERE id = ?').get(id);
  
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      ROUND(AVG(nota_geral), 2) as media_geral,
      ROUND(AVG(nota_cordialidade), 2) as media_cordialidade,
      ROUND(AVG(nota_agilidade), 2) as media_agilidade,
      ROUND(AVG(nota_resolucao), 2) as media_resolucao,
      SUM(CASE WHEN sentimento = 'positivo' THEN 1 ELSE 0 END) as positivos,
      SUM(CASE WHEN sentimento = 'neutro' THEN 1 ELSE 0 END) as neutros,
      SUM(CASE WHEN sentimento = 'negativo' THEN 1 ELSE 0 END) as negativos
    FROM pesquisas WHERE funcionario_id = ?
  `).get(id);

  // Evolução mensal
  const evolucao = (await db.prepare(`
    SELECT DATE(criado_em) as dia, ROUND(AVG(nota_geral), 2) as media, COUNT(*) as total
    FROM pesquisas WHERE funcionario_id = ?
    GROUP BY DATE(criado_em)
    ORDER BY dia DESC LIMIT 30
  `).all(id)).reverse();

  // Últimas avaliações
  const ultimasAvaliacoes = await db.prepare(`
    SELECT nota_geral, nota_cordialidade, nota_agilidade, nota_resolucao,
           comentario, sentimento, resumo_ia, tags_ia, nome_cliente, criado_em
    FROM pesquisas WHERE funcionario_id = ?
    ORDER BY criado_em DESC LIMIT 20
  `).all(id);

  // Tags mais recebidas
  const todasTags = await db.prepare('SELECT tags_ia FROM pesquisas WHERE funcionario_id = ? AND tags_ia != ?').all(id, '[]');
  const contadorTags = {};
  todasTags.forEach(row => {
    try { JSON.parse(row.tags_ia).forEach(t => { contadorTags[t] = (contadorTags[t] || 0) + 1; }); } catch (e) {}
  });
  const topTags = Object.entries(contadorTags).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag, count]) => ({ tag, count }));

  // Tendência (comparar últimos 7 dias vs 7 anteriores)
  const recente = (await db.prepare(`
    SELECT ROUND(AVG(nota_geral), 2) as media FROM pesquisas
    WHERE funcionario_id = ? AND criado_em >= DATE('now', '-7 days')
  `).get(id)).media || 0;

  const anterior = (await db.prepare(`
    SELECT ROUND(AVG(nota_geral), 2) as media FROM pesquisas
    WHERE funcionario_id = ? AND criado_em >= DATE('now', '-14 days') AND criado_em < DATE('now', '-7 days')
  `).get(id)).media || 0;

  const tendencia = recente >= anterior ? 'subindo' : 'caindo';

  // Ranking geral
  const ranking = await db.prepare(`
    SELECT f.nome, ROUND(AVG(p.nota_geral), 2) as media, COUNT(p.id) as total
    FROM funcionarios f
    LEFT JOIN pesquisas p ON f.id = p.funcionario_id
    WHERE f.ativo = 1
    GROUP BY f.id
    HAVING total > 0
    ORDER BY media DESC
  `).all();

  const minhaPosicao = ranking.findIndex(r => r.nome === func.nome) + 1;

  // Frase motivacional com IA
  const topQualidade = topTags.length > 0 ? topTags[0].tag : 'atendimento';
  const frase = await gerarFraseMotivacional({
    nome: func.nome.split(' ')[0],
    mediaAtual: stats.media_geral || 0,
    tendencia,
    topQualidade
  });

  res.json({
    funcionario: func,
    stats,
    evolucao,
    ultimasAvaliacoes,
    topTags,
    tendencia,
    minhaPosicao,
    totalNoRanking: ranking.length,
    fraseMotivacional: frase
  });
});

// Ranking da equipe (funcionário só vê nomes e médias, sem comentários)
router.get('/ranking', async (req, res) => {
  const ranking = await db.prepare(`
    SELECT f.nome, f.setor, f.cargo,
           ROUND(AVG(p.nota_geral), 2) as media,
           COUNT(p.id) as total_avaliacoes,
           SUM(CASE WHEN p.sentimento = 'positivo' THEN 1 ELSE 0 END) as positivos
    FROM funcionarios f
    LEFT JOIN pesquisas p ON f.id = p.funcionario_id
    WHERE f.ativo = 1
    GROUP BY f.id
    HAVING total_avaliacoes > 0
    ORDER BY media DESC
  `).all();

  res.json(ranking);
});

module.exports = router;
