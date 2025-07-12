const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const cors = require('cors');
const qrcode = require('qrcode');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

let client;
let qrCodeBase64 = null;
let conectado = false;

// Inicializa o cliente WhatsApp
function iniciarCliente() {
  client = new Client({
    authStrategy: new LocalAuth({ clientId: 'cna-saas' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', async (qr) => {
    qrCodeBase64 = await qrcode.toDataURL(qr);
    conectado = false;
    console.log('📲 QR Code gerado. Aguardando leitura...');
  });

  client.on('ready', () => {
    conectado = true;
    qrCodeBase64 = null;
    console.log('✅ WhatsApp conectado com sucesso!');
  });

  client.on('disconnected', () => {
    conectado = false;
    console.log('❌ WhatsApp desconectado. Reiniciando...');
    iniciarCliente(); // Tenta reconectar automaticamente
  });

  client.initialize();
}

iniciarCliente();

// Rota para retornar o QR Code
app.get('/qr', (req, res) => {
  if (qrCodeBase64) {
    res.send(qrCodeBase64);
  } else {
    res.status(404).send('QR Code ainda não disponível.');
  }
});

// Rota para verificar status da conexão
app.get('/status', (req, res) => {
  res.json({ status: conectado ? 'CONECTADO' : 'DESCONECTADO' });
});

// Rota para iniciar manualmente (se necessário)
app.get('/initialize', (req, res) => {
  iniciarCliente();
  res.send('Cliente WhatsApp reiniciado.');
});

// Rota para enviar mensagem de texto
app.post('/send', async (req, res) => {
  const { number, message } = req.body;
  if (!number || !message) return res.status(400).send('Número e mensagem obrigatórios.');

  try {
    const numeroFormatado = number.includes('@c.us') ? number : `${number}@c.us`;
    await client.sendMessage(numeroFormatado, message);
    res.send('Mensagem enviada com sucesso.');
  } catch (error) {
    res.status(500).send('Erro ao enviar mensagem.');
  }
});

// Rota para envio de mídia (imagem, áudio, PDF etc.)
app.post('/send-media', async (req, res) => {
  const { number, mediaBase64, filename, mimetype } = req.body;

  if (!number || !mediaBase64 || !filename || !mimetype) {
    return res.status(400).send('Dados de mídia incompletos.');
  }

  try {
    const media = new MessageMedia(mimetype, mediaBase64, filename);
    const numeroFormatado = number.includes('@c.us') ? number : `${number}@c.us`;
    await client.sendMessage(numeroFormatado, media);
    res.send('Mídia enviada com sucesso.');
  } catch (error) {
    res.status(500).send('Erro ao enviar mídia.');
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
