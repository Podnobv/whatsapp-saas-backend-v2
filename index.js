const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const mime = require('mime-types');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());
app.use(fileUpload());

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  }
});

// SOCKET.IO

client.on('qr', async (qr) => {
  const qrCodeDataURL = await qrcode.toDataURL(qr);
  io.emit('qr', qrCodeDataURL);
});

client.on('ready', () => {
  console.log('✅ Cliente WhatsApp pronto!');
  io.emit('ready', 'WhatsApp conectado com sucesso!');
});

client.on('auth_failure', () => {
  console.error('❌ Falha na autenticação');
  io.emit('auth_failure', 'Falha na autenticação');
});

client.on('disconnected', (reason) => {
  console.warn('⚠️ Cliente desconectado:', reason);
  io.emit('disconnected', reason);
});

client.on('message', async (msg) => {
  const contato = await msg.getContact();
  const remetente = contato.number;
  const mensagem = msg.body;
  console.log(`📥 Mensagem de ${remetente}: ${mensagem}`);
  io.emit('message', { remetente, mensagem });
});

client.initialize();

// ROTAS

app.get('/', (req, res) => {
  res.send('Servidor WhatsApp SaaS está rodando.');
});

app.post('/send-message', async (req, res) => {
  const { number, message } = req.body;
  if (!number || !message) return res.status(400).send('Número e mensagem obrigatórios.');
  try {
    await client.sendMessage(`${number}@c.us`, message);
    res.status(200).send('Mensagem enviada com sucesso!');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao enviar mensagem.');
  }
});

app.post('/send-media', async (req, res) => {
  if (!req.files || !req.files.file) return res.status(400).send('Arquivo ausente.');
  const file = req.files.file;
  const number = req.body.number;
  const tempPath = path.join(__dirname, 'temp', file.name);

  try {
    await file.mv(tempPath);
    const mimetype = mime.lookup(file.name);
    const { MessageMedia } = require('whatsapp-web.js');
    const media = MessageMedia.fromFilePath(tempPath);
    media.mimetype = mimetype;
    await client.sendMessage(`${number}@c.us`, media);
    fs.unlinkSync(tempPath);
    res.status(200).send('Mídia enviada com sucesso!');
  } catch (error) {
    console.error('Erro ao enviar mídia:', error);
    res.status(500).send('Erro ao enviar mídia');
  }
});

server.listen(3000, () => {
  console.log('🚀 Servidor rodando na porta 3000');
});
