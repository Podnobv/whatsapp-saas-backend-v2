const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// CORS corrigido para aceitar seu domínio no Loveble
const allowedOrigins = [
  'https://7dd9de11-ef1a-4edb-bbb7-f320a9478702.lovableproject.com',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS não permitido para este domínio: ' + origin));
    }
  }
}));

app.use(express.json());

let client;
let currentQr = null;
let clientReady = false;

// Inicializa o WhatsApp
const initializeWhatsApp = () => {
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      args: ['--no-sandbox'],
      headless: true
    }
  });

  client.on('qr', (qr) => {
    qrcode.toDataURL(qr, (err, url) => {
      currentQr = url;
    });
  });

  client.on('ready', () => {
    console.log('✅ Cliente conectado!');
    clientReady = true;
    currentQr = null;
  });

  client.on('disconnected', () => {
    console.log('⚠️ Cliente desconectado.');
    clientReady = false;
    currentQr = null;
    initializeWhatsApp(); // Recomeça a conexão
  });

  client.initialize();
};

// Inicia cliente WhatsApp ao subir servidor
initializeWhatsApp();

// Rota: Status da conexão
app.get('/status', async (req, res) => {
  res.json({
    status: clientReady ? 'conectado' : 'desconectado',
    qr: currentQr
  });
});

// Rota: Gera QR Code
app.post('/initialize', async (req, res) => {
  if (!clientReady) {
    initializeWhatsApp();
    res.status(200).json({ message: 'Iniciando conexão com WhatsApp' });
  } else {
    res.status(200).json({ message: 'Já conectado' });
  }
});

// Rota: Envia mensagem de texto
app.post('/send-message', async (req, res) => {
  const { number, message } = req.body;

  if (!clientReady) {
    return res.status(400).json({ error: 'WhatsApp não conectado' });
  }

  try {
    const formattedNumber = number.includes('@c.us') ? number : `${number}@c.us`;
    await client.sendMessage(formattedNumber, message);
    res.status(200).json({ success: true, message: 'Mensagem enviada com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao enviar mensagem', details: error.message });
  }
});

// Rota raiz
app.get('/', (req, res) => {
  res.send('Servidor WhatsApp SaaS rodando com sucesso!');
});

// Inicia servidor
app.listen(port, () => {
  console.log(`🚀 Servidor backend rodando na porta ${port}`);
});
