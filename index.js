const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const socketIO = require('socket.io');
const http = require('http');
const cors = require('cors');
const mime = require('mime-types');
const multer = require('multer');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
  }
});

app.use(cors());
app.use(express.json());
app.use(fileUpload());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const SESSION_DIR = './session';
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR);

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  }
});

client.on('qr', async (qr) => {
  const qrImage = await qrcode.toDataURL(qr);
  io.emit('qr', qrImage);
  io.emit('message', '📲 Leia o QR Code com seu WhatsApp.');
});

client.on('ready', () => {
  io.emit('ready', '✅ WhatsApp conectado!');
  io.emit('message', '🟢 Cliente conectado com sucesso!');
});

client.on('auth_failure', () => {
  io.emit('message', '❌ Falha na autenticação. Reinicie o servidor.');
});

client.on('disconnected', () => {
  io.emit('message', '⚠️ WhatsApp desconectado. Reinicie o servidor.');
});

client.initialize();

// Endpoint teste
app.get('/', (req, res) => {
  res.send('✅ Backend do WhatsApp SaaS está rodando!');
});

// Enviar mensagem
app.post('/send', async (req, res) => {
  const { number, message } = req.body;
  try {
    const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
    await client.sendMessage(chatId, message);
    res.send({ status: 'Mensagem enviada com sucesso.' });
  } catch (error) {
    res.status(500).send({ error: 'Erro ao enviar mensagem.', detail: error });
  }
});

// WebSocket
io.on('connection', (socket) => {
  socket.emit('message', '🖥️ WebSocket conectado ao backend!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
