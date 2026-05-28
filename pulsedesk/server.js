require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const { ready } = require('./database');

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Disponibilizar io para as rotas
app.set('io', io);

// Rotas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pesquisa', require('./routes/pesquisa'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/funcionario', require('./routes/funcionario'));

// Rota raiz → login
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Socket.io — painel admin em tempo real
io.on('connection', (socket) => {
  console.log('Admin conectado ao painel em tempo real');
  socket.on('disconnect', () => console.log('Admin desconectado'));
});

const PORT = process.env.PORT || 3000;
ready
  .then(() => {
    server.listen(PORT, () => {
      console.log(`\n🚀 PulseDesk rodando em http://localhost:${PORT}`);
      console.log(`📊 Admin:       http://localhost:${PORT}/admin.html`);
      console.log(`👤 Funcionário: http://localhost:${PORT}/funcionario.html`);
      console.log(`📝 Pesquisa:    http://localhost:${PORT}/pesquisa.html`);
      console.log(`\n🔑 Login admin:       admin@pulsedesk.com / admin123`);
      console.log(`🔑 Login funcionário: ana@empresa.com / senha123\n`);
    });
  })
  .catch((err) => {
    console.error('Falha ao inicializar o banco de dados:', err);
    process.exit(1);
  });
