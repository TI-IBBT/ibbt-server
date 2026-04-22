# IBBT Stage Gate Process — Servidor v2
## Guia de Instalação para o TI

### O que há de novo nesta versão
- **Dossiê do Produto**: documento único evolutivo que substitui o briefing e o caderno de especificações
- Novo projeto abre automaticamente o Dossiê para preencher
- Geração de Caderno de Especificações em Word (.doc) na fase de Transferência
- Interface renomeada: "Novo Briefing" → "Novo Dossiê"

---

### Requisitos
- Node.js versão 18 ou superior
- Windows Server, Linux ou qualquer máquina ligada 24h na rede

### Instalação

1. **Copiar a pasta** `ibbt-server/` para o servidor (ex: `C:\IBBT\stage-gate\`)

2. **Instalar dependências** (só na primeira vez — precisa de internet):
```
cd C:\IBBT\stage-gate
npm install
```

3. **Iniciar o servidor:**
```
node server.js
```

4. **Acesso pela equipe** — cada pessoa digita no navegador:
```
http://[IP-DO-SERVIDOR]:3000
```
Para descobrir o IP: `ipconfig` no servidor, anotar o Endereço IPv4.

---

### Usuários padrão (criados automaticamente)
- `danielli@ibbt.com.br` / `ibbt@2026` — Administradora
- `raphael@ibbt.com.br`  / `ibbt@2026` — Diretoria

**Trocar a senha no primeiro acesso:** clicar em "🔑 Minha senha" no topo.

---

### Manter o servidor sempre ligado (Windows)
```
npm install -g pm2
pm2 start server.js --name ibbt-stage-gate
pm2 startup
pm2 save
```

### Backup
Copiar o arquivo `ibbt.db` periodicamente — contém todos os dados do sistema.

### Criar novos usuários
1. Entrar como Danielli (admin)
2. Menu lateral → Usuários → + Novo Usuário
3. Preencher nome, e-mail, perfil
4. Enviar o **token gerado** para o usuário por e-mail ou WhatsApp
5. O usuário acessa o sistema → "Primeiro acesso?" → cola o token → cria a própria senha

