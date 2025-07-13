const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const qrcode = require('qrcode');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const mime = require('mime-types');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(fileUpload());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

let qrCodeData = null;
let isConnected = false;

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox'],
  },
});

client.on('qr', (qr) => {
  qrCodeData = qr;
  qrcode.toDataURL(qr, (err, url) => {
    if (!err) {
      io.emit('qr', url);
    }
  });
});

client.on('ready', () => {
  console.log('✅ Cliente pronto!');
  isConnected = true;
  io.emit('ready', 'WhatsApp conectado!');
});

client.on('authenticated', () => {
  console.log('🔐 Autenticado com sucesso');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Falha na autenticação', msg);
});

client.on('disconnected', (reason) => {
  console.log('🔌 Desconectado:', reason);
  isConnected = false;
  client.initialize();
});

client.on('message', async (message) => {
  if (message.body.toLowerCase() === 'oi' || message.body.toLowerCase() === 'olá') {
    message.reply('Olá! Seja bem-vindo ao atendimento da nossa escola. Em que posso ajudar? 😊');
  }
  io.emit('received-message', {
    from: message.from,
    body: message.body,
  });
});

client.initialize();

// ROTAS

app.get('/', (req, res) => {
  res.send('🚀 API do WhatsApp SaaS está ativa!');
});

app.get('/qr', (req, res) => {
  if (qrCodeData) {
    qrcode.toDataURL(qrCodeData, (err, src) => {
      if (err) return res.status(500).send('Erro ao gerar QR Code');
      res.send(`<img src="${src}">`);
    });
  } else {
    res.send('Aguardando QR Code...');
  }
});

app.get('/status', (req, res) => {
  res.json({ connected: isConnected });
});

app.post('/send-message', async (req, res) => {
  const { number, message } = req.body;

  if (!number || !message) {
    return res.status(400).json({ error: 'Número e mensagem são obrigatórios.' });
  }

  const formattedNumber = number.includes('@c.us') ? number : `${number}@c.us`;

  try {
    await client.sendMessage(formattedNumber, message);
    res.status(200).json({ success: true, message: 'Mensagem enviada com sucesso!' });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ success: false, error: 'Falha ao enviar mensagem.' });
  }
});

// ENVIO DE MÍDIA
app.post('/send-media', async (req, res) => {
  const { number } = req.body;
  const file = req.files?.media;

  if (!number || !file) {
    return res.status(400).json({ error: 'Número e mídia são obrigatórios.' });
  }

  const filePath = `uploads/${Date.now()}_${file.name}`;
  await file.mv(filePath);

  const media = require('whatsapp-web.js').MessageMedia.fromFilePath(filePath);

  const formattedNumber = number.includes('@c.us') ? number : `${number}@c.us`;

  try {
    await client.sendMessage(formattedNumber, media);
    res.status(200).json({ success: true, message: 'Mídia enviada com sucesso!' });
  } catch (error) {
    console.error('Erro ao enviar mídia:', error);
    res.status(500).json({ error: 'Erro ao enviar mídia' });
  }
});

io.on('connection', (socket) => {
  console.log('🔌 Novo socket conectado');

  if (qrCodeData) {
    qrcode.toDataURL(qrCodeData, (err, src) => {
      if (!err) {
        socket.emit('qr', src);
      }
    });
  }

  if (isConnected) {
    socket.emit('ready', 'WhatsApp conectado!');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
