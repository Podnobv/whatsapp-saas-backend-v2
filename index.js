const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const fileUpload = require('express-fileupload');
const qrcode = require('qrcode');
const fs = require('fs');
const mime = require('mime-types');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());
app.use(fileUpload());

const SESSION_FOLDER = './session';
if (!fs.existsSync(SESSION_FOLDER)) fs.mkdirSync(SESSION_FOLDER);

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_FOLDER }),
  puppeteer: {
    headless: true,
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

let qrCodeSVG = '';
let isReady = false;

client.on('qr', async (qr) => {
  qrCodeSVG = await qrcode.toDataURL(qr);
  io.emit('qr', qrCodeSVG);
  isReady = false;
});

client.on('ready', () => {
  console.log('✅ Cliente conectado ao WhatsApp!');
  io.emit('ready', 'ready');
  isReady = true;
});

client.on('authenticated', () => {
  console.log('🔒 Cliente autenticado.');
  io.emit('authenticated', 'authenticated');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Falha na autenticação:', msg);
  io.emit('auth_failure', msg);
});

client.on('disconnected', (reason) => {
  console.log('🔌 Cliente desconectado:', reason);
  io.emit('disconnected', reason);
  isReady = false;
});

client.on('message', async (message) => {
  console.log('📩 Mensagem recebida:', message.body);
  io.emit('message', message);
});

client.initialize();

// Rotas REST
app.get('/', (req, res) => {
  res.send('🚀 Backend do WhatsApp SaaS ativo!');
});

app.get('/status', (req, res) => {
  res.json({ connected: isReady });
});

app.get('/qr', (req, res) => {
  res.json({ qr: qrCodeSVG });
});

app.post('/send-text', async (req, res) => {
  const { number, message } = req.body;
  try {
    const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
    await client.sendMessage(chatId, message);
    res.status(200).json({ status: 'Mensagem enviada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'Erro ao enviar mensagem' });
  }
});

app.post('/send-media', async (req, res) => {
  const { number } = req.body;
  if (!req.files || !req.files.media) {
    return res.status(400).json({ status: 'Arquivo não encontrado' });
  }

  const media = req.files.media;
  const mediaPath = path.join(__dirname, 'temp', media.name);

  fs.mkdirSync(path.join(__dirname, 'temp'), { recursive: true });
  media.mv(mediaPath, async (err) => {
    if (err) return res.status(500).json({ status: 'Erro ao salvar mídia' });

    const mimetype = mime.lookup(mediaPath);
    const base64 = fs.readFileSync(mediaPath, { encoding: 'base64' });
    const { MessageMedia } = require('whatsapp-web.js');
    const chatId = number.includes('@c.us') ? number : `${number}@c.us`;

    try {
      const mediaMsg = new MessageMedia(mimetype, base64, media.name);
      await client.sendMessage(chatId, mediaMsg);
      res.status(200).json({ status: 'Mídia enviada' });
    } catch (error) {
      res.status(500).json({ status: 'Erro ao enviar mídia' });
    } finally {
      fs.unlinkSync(mediaPath);
    }
  });
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('🟢 Conectado via WebSocket');

  if (qrCodeSVG && !isReady) socket.emit('qr', qrCodeSVG);
  if (isReady) socket.emit('ready', 'ready');

  socket.on('disconnect', () => {
    console.log('🔴 WebSocket desconectado');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
