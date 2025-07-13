const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const fileUpload = require('express-fileupload');
const qrcode = require('qrcode');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const mime = require('mime-types');
const cors = require('cors');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(fileUpload());

let qrCodeData = null;
let isAuthenticated = false;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

client.on('qr', async (qr) => {
    qrCodeData = await qrcode.toDataURL(qr);
    isAuthenticated = false;
    io.emit('qr', qrCodeData);
    console.log('QR gerado. Escaneie com o celular.');
});

client.on('ready', () => {
    console.log('✅ Cliente WhatsApp conectado e pronto!');
    isAuthenticated = true;
    io.emit('ready');
});

client.on('authenticated', () => {
    console.log('🔐 Autenticado com sucesso.');
    isAuthenticated = true;
    io.emit('authenticated');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Falha na autenticação:', msg);
    isAuthenticated = false;
    io.emit('auth_failure', msg);
});

client.on('disconnected', (reason) => {
    console.log('🚫 Cliente desconectado:', reason);
    isAuthenticated = false;
    io.emit('disconnected', reason);
    client.initialize(); // Tenta reconectar
});

client.on('message', (msg) => {
    console.log(`📩 Mensagem recebida de ${msg.from}: ${msg.body}`);
    io.emit('message', { from: msg.from, body: msg.body });
});

app.get('/', (req, res) => {
    res.send('Servidor backend do WhatsApp SaaS está rodando!');
});

app.get('/qr', (req, res) => {
    if (qrCodeData) {
        res.send(`<img src="${qrCodeData}" />`);
    } else {
        res.send('Nenhum QR Code disponível no momento.');
    }
});

app.get('/status', (req, res) => {
    res.send({ connected: isAuthenticated });
});

app.post('/send-message', async (req, res) => {
    const { number, message } = req.body;
    if (!number || !message) {
        return res.status(400).send('Número e mensagem são obrigatórios.');
    }

    try {
        const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
        await client.sendMessage(chatId, message);
        res.send({ status: 'Mensagem enviada com sucesso!' });
    } catch (error) {
        res.status(500).send('Erro ao enviar mensagem: ' + error.message);
    }
});

app.post('/send-media', async (req, res) => {
    if (!req.files || !req.files.file) {
        return res.status(400).send('Nenhum arquivo enviado.');
    }

    const file = req.files.file;
    const { number } = req.body;

    if (!number) {
        return res.status(400).send('Número do destinatário é obrigatório.');
    }

    const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
    const mediaPath = path.join(__dirname, 'temp', file.name);

    fs.mkdirSync(path.dirname(mediaPath), { recursive: true });
    fs.writeFileSync(mediaPath, file.data);

    try {
        const { MessageMedia } = require('whatsapp-web.js');
        const media = new MessageMedia(mime.lookup(mediaPath), file.data.toString('base64'), file.name);
        await client.sendMessage(chatId, media);
        res.send({ status: 'Mídia enviada com sucesso!' });
    } catch (err) {
        res.status(500).send('Erro ao enviar mídia: ' + err.message);
    } finally {
        fs.unlinkSync(mediaPath); // Remove o arquivo após envio
    }
});

// Inicialização
server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    client.initialize();
});
