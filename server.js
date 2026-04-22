// ═══════════════════════════════════════════════
// IBBT Stage Gate Process — Servidor
// Node.js + Express + SQLite
// ═══════════════════════════════════════════════

const express    = require('express');
//const Database   = require('better-sqlite3');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const path       = require('path');
const crypto     = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ibbt-sgp-secret-2026-trocar-em-producao';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.post('/api/login', (req, res) => {
  const { usuario, senha } = req.body;

  if (usuario === 'raphael' && senha === '123456') {
    return res.json({ ok: true, nome: 'Raphael' });
  }

  if (usuario === 'danielli' && senha === '123456') {
    return res.json({ ok: true, nome: 'Danielli' });
  }

  return res.status(401).json({ error: 'Login inválido' });
});
// ═══════════════════════════════════════════════
// BANCO DE DADOS
// ═══════════════════════════════════════════════
//const db = new Database(path.join(__dirname, 'ibbt.db'));
//db.pragma('journal_mode = WAL');
//db.pragma('foreign_keys = ON');

//db.exec(`
  //CREATE TABLE IF NOT EXISTS usuarios (
    //id          TEXT PRIMARY KEY,
    //nome        TEXT NOT NULL,
    //email       TEXT UNIQUE NOT NULL,
    //senha_hash  TEXT,
    //perfil      TEXT DEFAULT 'membro',
    //ativo       INTEGER DEFAULT 1,
    //primeiro_acesso INTEGER DEFAULT 1,
    //token_temp  TEXT,
    //criado_em   TEXT NOT NULL,
    //criado_por  TEXT
  );

  //CREATE TABLE IF NOT EXISTS projetos (
    //id           TEXT PRIMARY KEY,
    //dados        TEXT NOT NULL,
    //criado_em    TEXT NOT NULL,
    //criado_por   TEXT NOT NULL,
    //criado_nome  TEXT NOT NULL,
    //atualizado_em   TEXT,
    //atualizado_por  TEXT,
    //atualizado_nome TEXT
  );

  //CREATE TABLE IF NOT EXISTS audit_log (
    //id           TEXT PRIMARY KEY,
    //projeto_id   TEXT,
    //projeto_nome TEXT,
    //acao         TEXT NOT NULL,
    //descricao    TEXT,
    //usuario_id   TEXT NOT NULL,
    //usuario_nome TEXT NOT NULL,
    //timestamp    TEXT NOT NULL
  );
//`);

// Criar admin padrão se não existir
//const adminExiste = db.prepare('SELECT id FROM usuarios WHERE perfil IN (?,?)').get('admin','diretoria');
//if (!adminExiste) {
  //const agora = new Date().toISOString();
  //const adminHash = bcrypt.hashSync('ibbt@2026', 10);
  //db.prepare(`INSERT INTO usuarios (id,nome,email,senha_hash,perfil,ativo,primeiro_acesso,criado_em) VALUES (?,?,?,?,?,1,0,?)`)
    //.run('U001','Danielli','danielli@ibbt.com.br', adminHash, 'admin', agora);
  //db.prepare(`INSERT INTO usuarios (id,nome,email,senha_hash,perfil,ativo,primeiro_acesso,criado_em) VALUES (?,?,?,?,?,1,0,?)`)
    //.run('U002','Raphael','raphael@ibbt.com.br', adminHash, 'diretoria', agora);
  //console.log('✅ Usuários admin criados: danielli@ibbt.com.br / ibbt@2026');
//}

// ═══════════════════════════════════════════════
// REAL-TIME (Server-Sent Events)
// ═══════════════════════════════════════════════
const clientes = new Set();

function broadcast(evento, dados) {
  const msg = `data: ${JSON.stringify({ evento, dados })}\n\n`;
  clientes.forEach(res => { try { res.write(msg); } catch(e) { clientes.delete(res); }});
}

app.get('/api/eventos', autenticar, (req, res) => {
  res.set({ 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache', 'Connection':'keep-alive' });
  res.flushHeaders();
  res.write('data: {"evento":"conectado"}\n\n');
  clientes.add(res);
  req.on('close', () => clientes.delete(res));
});

// ═══════════════════════════════════════════════
// MIDDLEWARE DE AUTENTICAÇÃO
// ═══════════════════════════════════════════════
function autenticar(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ erro: 'Não autenticado' });
  try {
    req.usuario = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch(e) {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

function apenasAdmin(req, res, next) {
  if (!['admin','diretoria'].includes(req.usuario.perfil))
    return res.status(403).json({ erro: 'Acesso restrito a administradores' });
  next();
}

function uid() { return crypto.randomBytes(8).toString('hex'); }
function agora() { return new Date().toISOString(); }

// ═══════════════════════════════════════════════
// ROTAS — AUTENTICAÇÃO
// ═══════════════════════════════════════════════

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' });

  const u = db.prepare('SELECT * FROM usuarios WHERE email = ? AND ativo = 1').get(email.toLowerCase().trim());
  if (!u) return res.status(401).json({ erro: 'Email ou senha incorretos' });
  if (!u.senha_hash) return res.status(403).json({ erro: 'primeiro_acesso', msg: 'Você ainda não definiu sua senha.' });

  const ok = bcrypt.compareSync(senha, u.senha_hash);
  if (!ok) return res.status(401).json({ erro: 'Email ou senha incorretos' });

  const token = jwt.sign({ id:u.id, nome:u.nome, email:u.email, perfil:u.perfil }, JWT_SECRET, { expiresIn:'12h' });
  res.json({ token, usuario: { id:u.id, nome:u.nome, email:u.email, perfil:u.perfil, primeiro_acesso: u.primeiro_acesso } });
});

// Definir senha (primeiro acesso via token temporário)
app.post('/api/auth/definir-senha', (req, res) => {
  const { token_temp, nova_senha } = req.body;
  if (!token_temp || !nova_senha) return res.status(400).json({ erro: 'Dados incompletos' });
  if (nova_senha.length < 6) return res.status(400).json({ erro: 'Senha deve ter ao menos 6 caracteres' });

  const u = db.prepare('SELECT * FROM usuarios WHERE token_temp = ? AND ativo = 1').get(token_temp);
  if (!u) return res.status(404).json({ erro: 'Token inválido ou expirado' });

  const hash = bcrypt.hashSync(nova_senha, 10);
  db.prepare('UPDATE usuarios SET senha_hash=?, token_temp=NULL, primeiro_acesso=0 WHERE id=?').run(hash, u.id);

  const jwtToken = jwt.sign({ id:u.id, nome:u.nome, email:u.email, perfil:u.perfil }, JWT_SECRET, { expiresIn:'12h' });
  res.json({ token: jwtToken, usuario: { id:u.id, nome:u.nome, email:u.email, perfil:u.perfil } });
});

// Alterar senha (usuário logado)
app.post('/api/auth/alterar-senha', autenticar, (req, res) => {
  const { senha_atual, nova_senha } = req.body;
  if (!senha_atual || !nova_senha) return res.status(400).json({ erro: 'Dados incompletos' });
  if (nova_senha.length < 6) return res.status(400).json({ erro: 'Nova senha deve ter ao menos 6 caracteres' });

  const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.usuario.id);
  if (!bcrypt.compareSync(senha_atual, u.senha_hash))
    return res.status(401).json({ erro: 'Senha atual incorreta' });

  const hash = bcrypt.hashSync(nova_senha, 10);
  db.prepare('UPDATE usuarios SET senha_hash=?, primeiro_acesso=0 WHERE id=?').run(hash, req.usuario.id);
  res.json({ ok: true });
});

// Me (quem estou)
app.get('/api/auth/me', autenticar, (req, res) => {
  const u = db.prepare('SELECT id,nome,email,perfil,primeiro_acesso FROM usuarios WHERE id=?').get(req.usuario.id);
  res.json(u);
});

// ═══════════════════════════════════════════════
// ROTAS — USUÁRIOS (admin)
// ═══════════════════════════════════════════════

app.get('/api/usuarios', autenticar, apenasAdmin, (req, res) => {
  const lista = db.prepare('SELECT id,nome,email,perfil,ativo,primeiro_acesso,criado_em,criado_por FROM usuarios ORDER BY nome').all();
  res.json(lista);
});

app.post('/api/usuarios', autenticar, apenasAdmin, (req, res) => {
  const { nome, email, perfil } = req.body;
  if (!nome || !email) return res.status(400).json({ erro: 'Nome e email obrigatórios' });

  const existe = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email.toLowerCase().trim());
  if (existe) return res.status(409).json({ erro: 'Email já cadastrado' });

  const token_temp = crypto.randomBytes(16).toString('hex');
  const id = uid();
  db.prepare(`INSERT INTO usuarios (id,nome,email,perfil,ativo,primeiro_acesso,token_temp,criado_em,criado_por)
              VALUES (?,?,?,?,1,1,?,?,?)`)
    .run(id, nome.trim(), email.toLowerCase().trim(), perfil||'membro', token_temp, agora(), req.usuario.nome);

  registrarAudit(null, null, 'USUARIO_CRIADO', `Usuário ${nome} criado por ${req.usuario.nome}`, req.usuario.id, req.usuario.nome);
  broadcast('usuario_criado', { nome });

  res.json({ id, nome, email, perfil: perfil||'membro', token_temp,
    link_acesso: `http://SEU-SERVIDOR:${PORT}/definir-senha?token=${token_temp}` });
});

app.put('/api/usuarios/:id', autenticar, apenasAdmin, (req, res) => {
  const { nome, perfil, ativo } = req.body;
  const u = db.prepare('SELECT * FROM usuarios WHERE id=?').get(req.params.id);
  if (!u) return res.status(404).json({ erro: 'Usuário não encontrado' });
  if (u.id === req.usuario.id) return res.status(400).json({ erro: 'Não pode alterar o próprio perfil' });

  db.prepare('UPDATE usuarios SET nome=?, perfil=?, ativo=? WHERE id=?')
    .run(nome||u.nome, perfil||u.perfil, ativo!==undefined?ativo:u.ativo, u.id);

  registrarAudit(null, null, 'USUARIO_ALTERADO', `Usuário ${u.nome} alterado por ${req.usuario.nome}`, req.usuario.id, req.usuario.nome);
  broadcast('usuario_alterado', { id: u.id });
  res.json({ ok: true });
});

// Resetar senha (admin gera novo token)
app.post('/api/usuarios/:id/resetar-senha', autenticar, apenasAdmin, (req, res) => {
  const u = db.prepare('SELECT * FROM usuarios WHERE id=?').get(req.params.id);
  if (!u) return res.status(404).json({ erro: 'Usuário não encontrado' });

  const token_temp = crypto.randomBytes(16).toString('hex');
  db.prepare('UPDATE usuarios SET token_temp=?, senha_hash=NULL, primeiro_acesso=1 WHERE id=?').run(token_temp, u.id);

  registrarAudit(null, null, 'SENHA_RESETADA', `Senha de ${u.nome} resetada por ${req.usuario.nome}`, req.usuario.id, req.usuario.nome);
  res.json({ token_temp, link_acesso: `http://SEU-SERVIDOR:${PORT}/definir-senha?token=${token_temp}` });
});

// ═══════════════════════════════════════════════
// ROTAS — PROJETOS
// ═══════════════════════════════════════════════

app.get('/api/projetos', autenticar, (req, res) => {
  const lista = db.prepare('SELECT * FROM projetos ORDER BY criado_em DESC').all();
  res.json(lista.map(p => ({
    ...JSON.parse(p.dados),
    _meta: {
      criado_em: p.criado_em, criado_por: p.criado_por, criado_nome: p.criado_nome,
      atualizado_em: p.atualizado_em, atualizado_por: p.atualizado_por, atualizado_nome: p.atualizado_nome
    }
  })));
});

app.post('/api/projetos', autenticar, (req, res) => {
  const projeto = req.body;
  if (!projeto.id) projeto.id = uid();
  const now = agora();

  db.prepare(`INSERT INTO projetos (id,dados,criado_em,criado_por,criado_nome) VALUES (?,?,?,?,?)`)
    .run(projeto.id, JSON.stringify(projeto), now, req.usuario.id, req.usuario.nome);

  registrarAudit(projeto.id, projeto.crm||projeto.id, 'PROJETO_CRIADO',
    `Briefing "${projeto.crm}" criado`, req.usuario.id, req.usuario.nome);
  broadcast('projeto_criado', { id: projeto.id, crm: projeto.crm, nome: req.usuario.nome });

  res.json({ ok: true, id: projeto.id });
});

app.put('/api/projetos/:id', autenticar, (req, res) => {
  const projeto = req.body;
  const atual = db.prepare('SELECT * FROM projetos WHERE id=?').get(req.params.id);
  if (!atual) return res.status(404).json({ erro: 'Projeto não encontrado' });
  const now = agora();

  // Detectar o que mudou para o audit
  const dadosAntigos = JSON.parse(atual.dados);
  const descricoes = [];
  if (dadosAntigos.faseAtual !== projeto.faseAtual) {
    const fasesNomes = { nda:'NDA', briefing:'Briefing', oferta_bud:'Oferta Budget',
      budget_env:'Aguard. aceite cliente', gate1:'GATE 1', amostras:'Amostras',
      prototipos:'Protótipos', viabilidade:'Viabilidade', gate2:'GATE 2',
      testes:'Testes Industriais', hom_ibbt:'Homologar IBBT', hom_forn:'Homologar Fornecedores',
      oferta_vinc:'Oferta Vinculante', gate3:'GATE 3', handoff:'Handoff', producao:'Primeira Produção', conclusao:'Concluído' };
    descricoes.push(`Fase: ${fasesNomes[dadosAntigos.faseAtual]||dadosAntigos.faseAtual} → ${fasesNomes[projeto.faseAtual]||projeto.faseAtual}`);
  }
  if (dadosAntigos.status !== projeto.status) descricoes.push(`Status: ${dadosAntigos.status} → ${projeto.status}`);
  if (descricoes.length === 0) descricoes.push('Dados atualizados');

  db.prepare(`UPDATE projetos SET dados=?, atualizado_em=?, atualizado_por=?, atualizado_nome=? WHERE id=?`)
    .run(JSON.stringify(projeto), now, req.usuario.id, req.usuario.nome, req.params.id);

  registrarAudit(projeto.id, projeto.crm||projeto.id, 'PROJETO_ATUALIZADO',
    descricoes.join(' | '), req.usuario.id, req.usuario.nome);
  broadcast('projeto_atualizado', { id: projeto.id, crm: projeto.crm, alteracao: descricoes.join(' | '), por: req.usuario.nome });

  res.json({ ok: true });
});

// ═══════════════════════════════════════════════
// ROTAS — AUDIT LOG
// ═══════════════════════════════════════════════

app.get('/api/audit', autenticar, apenasAdmin, (req, res) => {
  const { projeto_id, limit } = req.query;
  let query = 'SELECT * FROM audit_log';
  const params = [];
  if (projeto_id) { query += ' WHERE projeto_id = ?'; params.push(projeto_id); }
  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(parseInt(limit)||200);
  res.json(db.prepare(query).all(...params));
});

app.get('/api/audit/projeto/:id', autenticar, (req, res) => {
  const log = db.prepare('SELECT * FROM audit_log WHERE projeto_id = ? ORDER BY timestamp DESC').all(req.params.id);
  res.json(log);
});

function registrarAudit(projeto_id, projeto_nome, acao, descricao, usuario_id, usuario_nome) {
  db.prepare(`INSERT INTO audit_log (id,projeto_id,projeto_nome,acao,descricao,usuario_id,usuario_nome,timestamp)
              VALUES (?,?,?,?,?,?,?,?)`)
    .run(uid(), projeto_id, projeto_nome, acao, descricao, usuario_id, usuario_nome, agora());
}

// ═══════════════════════════════════════════════
// SERVIR FRONTEND
// ═══════════════════════════════════════════════
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ═══════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🍫 IBBT Stage Gate Process`);
  console.log(`🌐 Acesse: http://localhost:${PORT}`);
  console.log(`📡 Na rede: http://[IP-DO-SERVIDOR]:${PORT}`);
  console.log(`\n👤 Admin padrão: danielli@ibbt.com.br / ibbt@2026`);
  console.log(`👤 Diretoria:    raphael@ibbt.com.br  / ibbt@2026\n`);
});
