const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'pulsedesk_secret_2024';

function authMiddleware(tipo) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ erro: 'Token não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      
      if (tipo && payload.tipo !== tipo) {
        return res.status(403).json({ erro: 'Acesso negado' });
      }

      req.usuario = payload;
      next();
    } catch (err) {
      return res.status(401).json({ erro: 'Token inválido ou expirado' });
    }
  };
}

module.exports = { authMiddleware, JWT_SECRET };
