const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

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
let isInitializing = false;

// Destroi cliente existente
const destroyClient = async () => {
  if (client) {
    try {
      await client.destroy();
      console.log('🔴 Cliente destruído');
    } catch (error) {
      console.error('Erro ao destruir cliente:', error);
    }
    client = null;
  }
};

// Inicializa o WhatsApp
const initializeWhatsApp = async () => {
  if (isInitializing) {
    console.log('⚠️ Inicialização já em andamento');
    return;
  }
  
  isInitializing = true;
  clientReady = false;
  currentQr = null;
  
  // Limpa cliente anterior
  await destroyClient();
  
  try {
    client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
        headless: true
      }
    });

    client.on('qr', (qr) => {
      console.log('📱 QR Code gerado');
      qrcode.toDataURL(qr, (err, url) => {
        if (err) {
          console.error('Erro ao gerar QR:', err);
          return;
        }
        currentQr = url;
      });
    });

    client.on('ready', () => {
      console.log('✅ Cliente conectado!');
      clientReady = true;
      currentQr = null;
      isInitializing = false;
    });

    client.on('disconnected', (reason) => {
      console.log('⚠️ Cliente desconectado:', reason);
      clientReady = false;
      currentQr = null;
      isInitializing = false;
      
      // Reconecta apenas se não foi desconexão manual
      if (reason !== 'NAVIGATION') {
        setTimeout(() => {
          console.log('🔄 Tentando reconectar...');
          initializeWhatsApp();
        }, 5000);
      }
    });

    client.on('auth_failure', (msg) => {
      console.error('❌ Falha na autenticação:', msg);
      isInitializing = false;
    });

    await client.initialize();
  } catch (error) {
    console.error('❌ Erro ao inicializar:', error);
    isInitializing = false;
  }
};

// Inicia cliente ao subir servidor
initializeWhatsApp();

// Rota: Status da conexão
app.get('/status', async (req, res) => {
  res.json({
    status: clientReady ? 'conectado' : 'desconectado',
    qr: currentQr,
    initializing: isInitializing
  });
});

// Rota: Gera QR Code
app.post('/initialize', async (req, res) => {
  if (isInitializing) {
    return res.status(200).json({ message: 'Inicialização já em andamento' });
  }
  
  if (clientReady) {
    return res.status(200).json({ message: 'Já conectado' });
  }
  
  initializeWhatsApp();
  res.status(200).json({ message: 'Iniciando conexão com WhatsApp' });
});

// Resto do código permanece igual...
