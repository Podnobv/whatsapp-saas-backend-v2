const express = require('express');
const { default: makeWASocket, useSingleFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const { state, saveState } = useSingleFileAuthState('./auth_info.json');

let sock;

async function startSock() {
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveState);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const qrImage = await qrcode.toDataURL(qr);
      fs.writeFileSync('./latest-qr.txt', qrImage);
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Conexão encerrada. Reconectar?', shouldReconnect);
      if (shouldReconnect) {
        startSock();
      }
    } else if (connection === 'open') {
      console.log('✅ Conectado com sucesso ao WhatsApp!');
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    console.log('📥 Mensagem recebida:', JSON.stringify(m, null, 2));
  });
}

startSock();

// === ROTAS API ===

app.get('/', (req, res) => {
  res.send({ status: 'Servidor backend WhatsApp ativo.' });
});

app.get('/qr', (req, res) => {
  try {
    const qrData = fs.readFileSync('./latest-qr.txt', 'utf-8');
    res.send({ qr: qrData });
  } catch (err) {
    res.status(404).send({ error: 'QR Code não disponível no momento.' });
  }
});

app.post('/send', async (req, res) => {
  const { number, message } = req.body;

  if (!number || !message) {
    return res.status(400).send({ error: 'Número e mensagem são obrigatórios.' });
  }

  const formattedNumber = number.includes('@s.whatsapp.net') ? number : number + '@s.whatsapp.net';

  try {
    await sock.sendMessage(formattedNumber, { text: message });
    res.send({ status: 'Mensagem enviada com sucesso.' });
  } catch (err) {
    console.error('Erro ao enviar:', err);
    res.status(500).send({ error: 'Erro ao enviar mensagem.' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});
