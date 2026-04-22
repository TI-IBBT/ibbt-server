const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

//
// 🔥 BANCO EM MEMÓRIA
//
const usuarios = [
  { id: '1', email: 'raphael@ibbt.com.br', senha: 'ibbt@2026', nome: 'Raphael', perfil: 'admin' },
  { id: '2', email: 'danielli@ibbt.com.br', senha: 'ibbt@2026', nome: 'Danielli', perfil: 'admin' }
];

const projetos = [];

//
// 🔐 LOGIN
//
app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;

  const user = usuarios.find(u => u.email === email && u.senha === senha);

  if (!user) {
    return res.status(401).json({ error: 'Login inválido' });
  }

  res.json({
    ok: true,
    usuario: user
  });
});

//
// 👤 USUÁRIOS
//
app.get('/api/usuarios', (req, res) => {
  res.json(usuarios);
});

app.post('/api/usuarios', (req, res) => {
  const novo = {
    id: Date.now().toString(),
    ...req.body
  };

  usuarios.push(novo);

  res.json({ ok: true, usuario: novo });
});

//
// 📁 PROJETOS
//
app.get('/api/projetos', (req, res) => {
  res.json(projetos);
});

app.post('/api/projetos', (req, res) => {
  const projeto = {
    id: Date.now().toString(),
    ...req.body
  };

  projetos.push(projeto);

  res.json({ ok: true, projeto });
});

//
// 🌐 FRONT
//
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

//
// 🚀 START
//
app.listen(PORT, '0.0.0.0', () => {
  console.log('Servidor rodando na porta ' + PORT);
});