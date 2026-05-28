const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { JWT_SECRET } = require('../middleware/auth');

// Login Admin
router.post('/admin/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' });

  const admin = await db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
  if (!admin) return res.status(401).json({ erro: 'Credenciais inválidas' });

  const valido = bcrypt.compareSync(senha, admin.senha_hash);
  if (!valido) return res.status(401).json({ erro: 'Credenciais inválidas' });

  const token = jwt.sign(
    { id: admin.id, nome: admin.nome, email: admin.email, tipo: 'admin' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, nome: admin.nome, tipo: 'admin' });
});

// Login Funcionário
router.post('/funcionario/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' });

  const func = await db.prepare('SELECT * FROM funcionarios WHERE email = ? AND ativo = 1').get(email);
  if (!func) return res.status(401).json({ erro: 'Credenciais inválidas' });

  const valido = bcrypt.compareSync(senha, func.senha_hash);
  if (!valido) return res.status(401).json({ erro: 'Credenciais inválidas' });

  const token = jwt.sign(
    { id: func.id, nome: func.nome, email: func.email, setor: func.setor, tipo: 'funcionario' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, nome: func.nome, setor: func.setor, tipo: 'funcionario' });
});

module.exports = router;
