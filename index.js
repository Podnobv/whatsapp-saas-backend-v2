const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(fileUpload());

// Autenticação local do WhatsApp
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

let qrCodeBase64 = '';
let conectado = false;

// Geração do QR Code
client.on('qr', async (qr) => {
  conectado = false;
  qrCodeBase64 = await qrcode.toDataURL(qr);
  console.log('📲 Novo QR Code gerado');
});

// Conectado
client.on('ready', () => {
  conectado = true;
  console.log('✅ Conectado ao WhatsApp');
});

// Desconectado
client.on('disconnected', () => {
  conectado = false;
  console.log('🔌 Desconectado do WhatsApp');
});

// Inicialização manual
app.get('/initialize', async (req, res) => {
  try {
    await client.initialize();
    res.send({ status: 'inicializando' });
  } catch (e) {
    res.status(500).send({ erro: 'Erro ao inicializar o cliente WhatsApp' });
  }
});

// Verifica status da conexão
app.get('/status', (req, res) => {
  res.send({
    status: conectado ? 'conectado' : 'desconectado',
    qr: conectado ? null : qrCodeBase64
  });
});

// Envio de mensagem de texto
app.post('/send-message', async (req, res) => {
  const { numero, mensagem } = req.body;
  if (!numero || !mensagem) {
    return res.status(400).send({ erro: 'Número e mensagem são obrigatórios.' });
  }

  const numeroFormatado = numero.includes('@c.us') ? numero : `${numero}@c.us`;

  try {
    await client.sendMessage(numeroFormatado, mensagem);
    res.send({ status: 'Mensagem enviada com sucesso' });
  } catch (err) {
    res.status(500).send({ erro: 'Erro ao enviar mensagem', detalhe: err.message });
  }
});

// Envio de mídia (imagem, PDF, etc.)
app.post('/send-media', async (req, res) => {
  const { numero } = req.body;
  if (!req.files || !req.files.arquivo || !numero) {
    return res.status(400).send({ erro: 'Arquivo e número são obrigatórios.' });
  }

  const arquivo = req.files.arquivo;
  const caminhoTemp = path.join(__dirname, 'temp', arquivo.name);

  if (!fs.existsSync(path.join(__dirname, 'temp'))) {
    fs.mkdirSync(path.join(__dirname, 'temp'));
  }

  try {
    await arquivo.mv(caminhoTemp);

    const mimetype = mime.lookup(caminhoTemp);
    const base64 = fs.readFileSync(caminhoTemp, { encoding: 'base64' });

    const media = new MessageMedia(mimetype, base64, arquivo.name);

    const numeroFormatado = numero.includes('@c.us') ? numero : `${numero}@c.us`;
    await client.sendMessage(numeroFormatado, media);

    fs.unlinkSync(caminhoTemp);

    res.send({ status: 'Arquivo enviado com sucesso' });
  } catch (err) {
    res.status(500).send({ erro: 'Erro ao enviar mídia', detalhe: err.message });
  }
});

// Inicializa o servidor
app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
