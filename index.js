import express from 'express';
import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import fileUpload from 'express-fileupload';
import mime from 'mime-types';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

app.use(cors());
app.use(express.json());
app.use(fileUpload());

let client;

const initializeWhatsApp = () => {
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      args: ['--no-sandbox'],
    }
  });

  client.on('qr', async (qr) => {
    const qrImage = await qrcode.toDataURL(qr);
    io.emit('qr', qrImage);
    io.emit('message', 'QR Code recebido, escaneie com seu celular!');
  });

  client.on('ready', () => {
    io.emit('ready', 'WhatsApp conectado com sucesso!');
    io.emit('message', 'WhatsApp está pronto!');
  });

  client.on('authenticated', () => {
    io.emit('message', 'Autenticado com sucesso!');
  });

  client.on('auth_failure', () => {
    io.emit('message', 'Falha na autenticação, reinicie o servidor.');
  });

  client.on('disconnected', () => {
    io.emit('message', 'WhatsApp desconectado. Reiniciando...');
    client.destroy();
    initializeWhatsApp();
  });

  client.on('message', async (msg) => {
    io.emit('received-message', {
      from: msg.from,
      body: msg.body
    });
  });

  client.initialize();
};

initializeWhatsApp();

app.get('/', (req, res) => {
  res.send('Servidor WhatsApp-SaaS ativo');
});

app.post('/send-message', async (req, res) => {
  const { number, message } = req.body;
  const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
  try {
    await client.sendMessage(chatId, message);
    res.send({ status: 'Mensagem enviada com sucesso!' });
  } catch (e) {
    res.status(500).send({ error: 'Erro ao enviar mensagem', details: e });
  }
});

app.post('/send-media', async (req, res) => {
  const { number, caption, fileName, mimeType } = req.body;
  const file = req.files?.file;

  if (!file) {
    return res.status(400).send({ error: 'Arquivo não encontrado.' });
  }

  const media = new MessageMedia(mimeType || mime.lookup(file.name), file.data.toString('base64'), fileName || file.name);
  const chatId = number.includes('@c.us') ? number : `${number}@c.us`;

  try {
    await client.sendMessage(chatId, media, { caption });
    res.send({ status: 'Mídia enviada com sucesso!' });
  } catch (e) {
    res.status(500).send({ error: 'Erro ao enviar mídia', details: e });
  }
});

app.get('/check-connection', (req, res) => {
  const info = client.info || {};
  res.send({
    connected: client?.info ? true : false,
    number: info.wid?.user || null,
    pushname: info.pushname || null
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Servidor rodando na porta 3000');
});
