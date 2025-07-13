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
    headless: true
  }
});

client.on('qr', (qr) => {
  console.log('QR RECEBIDO', qr);
  io.emit('qr', qr);
});

client.on('ready', () => {
  console.log('✅ Cliente pronto!');
  io.emit('ready', 'WhatsApp conectado com sucesso.');
});

client.on('authenticated', () => {
  console.log('🔐 Autenticado');
  io.emit('authenticated', 'Autenticado com sucesso.');
});

client.on('auth_failure', msg => {
  console.error('❌ Falha na autenticação', msg);
  io.emit('auth_failure', msg);
});

client.on('disconnected', reason => {
  console.log('🛑 Cliente desconectado', reason);
  io.emit('disconnected', reason);
});

client.on('message', async msg => {
  console.log('📩 Mensagem recebida:', msg.body);
  io.emit('message', { from: msg.from, body: msg.body });
});

client.initialize();

app.get('/', (req, res) => {
  res.send('🚀 Backend WhatsApp SaaS está rodando com sucesso!');
});

app.post('/send-message', async (req, res) => {
  const { number, message } = req.body;

  try {
    const sanitizedNumber = number.includes('@c.us') ? number : `${number}@c.us`;
    await client.sendMessage(sanitizedNumber, message);
    res.status(200).json({ status: 'Mensagem enviada com sucesso' });
  } catch (error) {
    res.status(500).json({ status: 'Erro ao enviar mensagem', error });
  }
});

const upload = multer({ dest: 'uploads/' });

app.post('/send-media', upload.single('media'), async (req, res) => {
  const { number } = req.body;
  const filePath = req.file.path;
  const fileMime = mime.lookup(filePath);
  const media = fs.readFileSync(filePath);

  const { MessageMedia } = require('whatsapp-web.js');
  const mediaMessage = new MessageMedia(fileMime, media.toString('base64'), req.file.originalname);

  try {
    const sanitizedNumber = number.includes('@c.us') ? number : `${number}@c.us`;
    await client.sendMessage(sanitizedNumber, mediaMessage);
    res.status(200).json({ status: 'Mídia enviada com sucesso' });
  } catch (error) {
    res.status(500).json({ status: 'Erro ao enviar mídia', error });
  } finally {
    fs.unlinkSync(filePath);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
