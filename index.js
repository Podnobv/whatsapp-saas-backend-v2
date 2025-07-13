const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const mime = require('mime-types');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let client;
let qrCodeBase64 = '';
let isConnected = false;

function createClient() {
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    },
  });

  client.on('qr', async (qr) => {
    const qrcodeDataUrl = await require('qrcode').toDataURL(qr);
    qrCodeBase64 = qrcodeDataUrl;
    console.log('[QR] QR Code gerado e enviado para o frontend.');
    io.emit('qr', qrcodeDataUrl);
  });

  client.on('ready', () => {
    isConnected = true;
    console.log('[WHATSAPP] Conectado com sucesso!');
    io.emit('ready', 'Conectado com sucesso!');
  });

  client.on('auth_failure', (msg) => {
    console.error('[ERRO] Falha de autenticação:', msg);
  });

  client.on('disconnected', (reason) => {
    console.error('[DESCONECTADO] Motivo:', reason);
    isConnected = false;
    io.emit('disconnected', reason);
    setTimeout(() => {
      console.log('[REINÍCIO] Tentando reconectar...');
      createClient();
      client.initialize();
    }, 5000); // tenta reconectar após 5 segundos
  });

  client.on('message', async (msg) => {
    try {
      console.log('[MENSAGEM] Recebida:', msg.body);
      io.emit('message', { from: msg.from, body: msg.body });
    } catch (error) {
      console.error('[ERRO ao processar mensagem]:', error);
    }
  });

  client.initialize();
}

createClient(); // inicia o client na primeira vez

// ROTAS
app.get('/', (req, res) => {
  res.send('✅ Backend WhatsApp está ativo.');
});

app.get('/status', (req, res) => {
  res.json({
    status: isConnected ? 'conectado' : 'desconectado',
    qr: isConnected ? null : qrCodeBase64,
  });
});

app.post('/send-message', async (req, res) => {
  try {
    const { number, message } = req.body;
    const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
    const sent = await client.sendMessage(chatId, message);
    res.send({ status: 'Mensagem enviada', data: sent });
  } catch (err) {
    console.error('[ERRO envio de mensagem]:', err);
    res.status(500).send({ error: 'Erro ao enviar mensagem', detail: err });
  }
});

app.post('/send-media', multer().single('file'), async (req, res) => {
  try {
    const { number } = req.body;
    const file = req.file;

    if (!file) return res.status(400).send({ error: 'Arquivo não enviado' });

    const media = {
      mimetype: file.mimetype,
      data: file.buffer,
      filename: file.originalname,
    };

    const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
    const sent = await client.sendMessage(chatId, media);
    res.send({ status: 'Mídia enviada com sucesso', data: sent });
  } catch (err) {
    console.error('[ERRO envio de mídia]:', err);
    res.status(500).send({ error: 'Erro ao enviar mídia', detail: err });
  }
});

// WebSocket
io.on('connection', (socket) => {
  console.log('[SOCKET.IO] Novo cliente conectado');
  if (isConnected) {
    socket.emit('ready', 'Conectado com sucesso!');
  } else if (qrCodeBase64) {
    socket.emit('qr', qrCodeBase64);
  }
});

// Porta de execução
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[SERVER] Backend iniciado na porta ${PORT}`);
});
