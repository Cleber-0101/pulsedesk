const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'pulsedesk.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Erro ao abrir o banco de dados:', err);
    process.exit(1);
  }
});

const normalizeParams = (params) => {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return [...params];
};

const runAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastInsertRowid: this.lastID, changes: this.changes });
    });
  });
};

const getAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

const allAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

const execAsync = (sql) => {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
};

const prepare = (sql) => ({
  run(...params) {
    return runAsync(sql, normalizeParams(params));
  },
  get(...params) {
    return getAsync(sql, normalizeParams(params));
  },
  all(...params) {
    return allAsync(sql, normalizeParams(params));
  }
});

async function initDatabase() {
  await execAsync(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS funcionarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      setor TEXT NOT NULL,
      cargo TEXT DEFAULT 'Atendente',
      foto_url TEXT DEFAULT NULL,
      token_pesquisa TEXT UNIQUE NOT NULL,
      ativo INTEGER DEFAULT 1,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pesquisas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      funcionario_id INTEGER NOT NULL,
      nota_cordialidade INTEGER NOT NULL CHECK(nota_cordialidade BETWEEN 1 AND 5),
      nota_agilidade INTEGER NOT NULL CHECK(nota_agilidade BETWEEN 1 AND 5),
      nota_resolucao INTEGER NOT NULL CHECK(nota_resolucao BETWEEN 1 AND 5),
      nota_geral REAL NOT NULL,
      comentario TEXT DEFAULT '',
      nome_cliente TEXT DEFAULT 'Anônimo',
      sentimento TEXT DEFAULT 'neutro',
      resumo_ia TEXT DEFAULT '',
      tags_ia TEXT DEFAULT '[]',
      score_ia REAL DEFAULT NULL,
      alerta INTEGER DEFAULT 0,
      ip_cliente TEXT DEFAULT '',
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)
    );

    CREATE TABLE IF NOT EXISTS alertas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pesquisa_id INTEGER NOT NULL,
      funcionario_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      mensagem TEXT NOT NULL,
      lido INTEGER DEFAULT 0,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pesquisa_id) REFERENCES pesquisas(id),
      FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_pesquisas_funcionario ON pesquisas(funcionario_id);
    CREATE INDEX IF NOT EXISTS idx_pesquisas_data ON pesquisas(criado_em);
    CREATE INDEX IF NOT EXISTS idx_alertas_lido ON alertas(lido);
  `);

  const adminExiste = await prepare('SELECT id FROM admins WHERE email = ?').get('admin@pulsedesk.com');
  if (!adminExiste) {
    const hash = bcrypt.hashSync('admin123', 10);
    await prepare('INSERT INTO admins (nome, email, senha_hash) VALUES (?, ?, ?)').run('Administrador', 'admin@pulsedesk.com', hash);
    console.log('✅ Admin padrão criado: admin@pulsedesk.com / admin123');
  }

  const funcExiste = await prepare('SELECT id FROM funcionarios LIMIT 1').get();
  if (!funcExiste) {
    const funcionariosSeed = [
      { nome: 'Ana Silva', email: 'ana@empresa.com', setor: 'Suporte', cargo: 'Atendente Senior' },
      { nome: 'Carlos Mendes', email: 'carlos@empresa.com', setor: 'Vendas', cargo: 'Consultor' },
      { nome: 'Beatriz Costa', email: 'beatriz@empresa.com', setor: 'Suporte', cargo: 'Atendente' },
      { nome: 'Diego Rocha', email: 'diego@empresa.com', setor: 'Financeiro', cargo: 'Analista' },
      { nome: 'Cleber', email: 'cleber@oaz.co', setor: 'tecnologia', cargo: 'Engenheiro de software' },
    ];

    const hash = bcrypt.hashSync('senha123', 10);
    for (const f of funcionariosSeed) {
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      await prepare(
        'INSERT INTO funcionarios (nome, email, senha_hash, setor, cargo, token_pesquisa) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(f.nome, f.email, hash, f.setor, f.cargo, token);
    }

    console.log('✅ Funcionários de exemplo criados (senha: senha123)');
  }

  console.log('✅ Banco de dados inicializado');
}

const ready = initDatabase().catch((err) => {
  console.error('Erro ao inicializar o banco:', err);
  process.exit(1);
});

module.exports = { prepare, exec: execAsync, pragma: (statement) => execAsync(`PRAGMA ${statement}`), ready };
