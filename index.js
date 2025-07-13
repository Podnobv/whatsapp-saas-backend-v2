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

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  },
});

let qrCodeString = '';
let isConnected = false;

client.on('qr', (qr) => {
  qrCodeString = qr;
  qrcode.generate(qr, { small: true });
  io.emit('qr', qr);
});

client.on('ready', () => {
  isConnected = true;
  console.log('WhatsApp conectado!');
  io.emit('ready', 'WhatsApp conectado!');
});

client.on('message', async (msg) => {
  console.log('Mensagem recebida:', msg.body);
  io.emit('message', { from: msg.from, body: msg.body });
});

app.get('/initialize', (req, res) => {
  res.send({ status: 'Inicializado', connected: isConnected });
});

app.post('/send-message', async (req, res) => {
  const { number, message } = req.body;
  const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
  try {
    const sent = await client.sendMessage(chatId, message);
    res.send({ status: 'Mensagem enviada', data: sent });
  } catch (error) {
    res.status(500).send({ status: 'Erro ao enviar', error });
  }
});

app.post('/send-media', multer().single('file'), async (req, res) => {
  const { number } = req.body;
  const file = req.file;

  if (!file) return res.status(400).send({ error: 'Arquivo não enviado' });

  const media = {
    mimetype: file.mimetype,
    data: file.buffer,
    filename: file.originalname,
  };

  const chatId = number.includes('@c.us') ? number : `${number}@c.us`;

  try {
    const sent = await client.sendMessage(chatId, media);
    res.send({ status: 'Arquivo enviado', data: sent });
  } catch (error) {
    res.status(500).send({ status: 'Erro ao enviar', error });
  }
});

client.initialize();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
