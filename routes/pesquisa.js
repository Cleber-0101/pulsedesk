const express = require('express');
const router = express.Router();
const db = require('../database');
const { analisarComentario } = require('../services/ia');

// Buscar funcionário pelo token da pesquisa (para exibir na tela pública)
router.get('/funcionario/:token', async (req, res) => {
  const func = await db.prepare(`
    SELECT id, nome, setor, cargo, foto_url 
    FROM funcionarios 
    WHERE token_pesquisa = ? AND ativo = 1
  `).get(req.params.token);

  if (!func) return res.status(404).json({ erro: 'Funcionário não encontrado' });
  res.json(func);
});

// Listar todos os funcionários ativos (para pesquisa geral)
router.get('/funcionarios', async (req, res) => {
  const funcionarios = await db.prepare(`
    SELECT id, nome, setor, cargo, foto_url, token_pesquisa
    FROM funcionarios 
    WHERE ativo = 1
    ORDER BY nome
  `).all();
  res.json(funcionarios);
});

// Submeter pesquisa
router.post('/enviar', async (req, res) => {
  const {
    token_funcionario,
    funcionario_id,
    nota_cordialidade,
    nota_agilidade,
    nota_resolucao,
    comentario,
    nome_cliente
  } = req.body;

  // Validações
  if (!nota_cordialidade || !nota_agilidade || !nota_resolucao) {
    return res.status(400).json({ erro: 'Todas as notas são obrigatórias' });
  }

  // Encontrar funcionário pelo token ou ID
  let func;
  if (token_funcionario) {
    func = await db.prepare('SELECT * FROM funcionarios WHERE token_pesquisa = ? AND ativo = 1').get(token_funcionario);
  } else if (funcionario_id) {
    func = await db.prepare('SELECT * FROM funcionarios WHERE id = ? AND ativo = 1').get(funcionario_id);
  }

  if (!func) return res.status(404).json({ erro: 'Funcionário não encontrado' });

  // Calcular nota geral
  const notaGeral = ((+nota_cordialidade + +nota_agilidade + +nota_resolucao) / 3).toFixed(2);

  // Análise de IA (assíncrona)
  const analise = await analisarComentario({
    comentario: comentario || '',
    notaGeral: +notaGeral,
    nomeFuncionario: func.nome
  });

  // Salvar no banco
  const insert = db.prepare(`
    INSERT INTO pesquisas (
      funcionario_id, nota_cordialidade, nota_agilidade, nota_resolucao,
      nota_geral, comentario, nome_cliente, sentimento, resumo_ia, tags_ia, score_ia, alerta, ip_cliente
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = await insert.run(
    func.id,
    +nota_cordialidade,
    +nota_agilidade,
    +nota_resolucao,
    +notaGeral,
    comentario || '',
    nome_cliente || 'Anônimo',
    analise.sentimento,
    analise.resumo_ia,
    analise.tags_ia,
    analise.score_ia,
    analise.alerta ? 1 : 0,
    req.ip
  );

  // Criar alerta se necessário
  if (analise.alerta) {
    await db.prepare(`
      INSERT INTO alertas (pesquisa_id, funcionario_id, tipo, mensagem)
      VALUES (?, ?, 'critico', ?)
    `).run(result.lastInsertRowid, func.id, analise.motivo_alerta || 'Feedback negativo detectado');
  }

  // Emitir evento via Socket.io para o painel admin
  if (req.app.get('io')) {
    req.app.get('io').emit('nova_pesquisa', {
      funcionario: func.nome,
      setor: func.setor,
      sentimento: analise.sentimento,
      nota: notaGeral,
      alerta: analise.alerta
    });
  }

  res.json({
    sucesso: true,
    mensagem: 'Obrigado pelo seu feedback!',
    sentimento: analise.sentimento
  });
});

module.exports = router;
