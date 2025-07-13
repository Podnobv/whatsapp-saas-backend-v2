const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
  }
});

app.use(cors());
app.use(express.json());

let qrCodeImage = null;
let isReady = false;

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  }
});

client.on('qr', async (qr) => {
  qrCodeImage = await qrcode.toDataURL(qr);
  isReady = false;
  io.emit('qr', qrCodeImage);
  console.log('QR code gerado');
});

client.on('ready', () => {
  console.log('✅ Cliente pronto!');
  isReady = true;
  io.emit('ready', true);
});

client.on('auth_failure', msg => {
  console.error('❌ Falha na autenticação:', msg);
});

client.on('disconnected', reason => {
  console.log('⚠️ Cliente desconectado:', reason);
  isReady = false;
  io.emit('ready', false);
});

client.on('message', message => {
  console.log('📩 Mensagem recebida:', message.body);
  io.emit('message', { from: message.from, body: message.body });
});

client.initialize();

app.get('/qr', (req, res) => {
  res.send({ qr: qrCodeImage, ready: isReady });
});

app.post('/send-message', async (req, res) => {
  const { number, message } = req.body;
  try {
    const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
    await client.sendMessage(chatId, message);
    res.send({ status: 'Mensagem enviada com sucesso' });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).send({ error: 'Erro ao enviar mensagem' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
