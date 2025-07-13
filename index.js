const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const fs = require("fs");
const mime = require("mime-types");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(fileUpload());

let client;
let lastQr = null;
let isReady = false;

// Inicializa o cliente WhatsApp somente após o servidor iniciar
async function initWhatsApp() {
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  client.on("qr", async (qr) => {
    console.log("QR Code recebido");
    lastQr = await qrcode.toDataURL(qr);
  });

  client.on("ready", () => {
    console.log("Cliente WhatsApp pronto!");
    isReady = true;
  });

  client.initialize();
}

// Rota inicial
app.get("/", (req, res) => {
  res.send("Servidor WhatsApp SaaS está rodando.");
});

// Geração do QR Code
app.get("/generate-qr", async (req, res) => {
  if (lastQr) {
    res.send(`<img src="${lastQr}" alt="QR Code"/>`);
  } else {
    res.send("Aguardando QR Code...");
  }
});

// Envio de mensagem
app.post("/send-message", async (req, res) => {
  const { number, message } = req.body;
  const numberWithCode = number + "@c.us";

  if (!isReady) {
    return res.status(400).json({ success: false, message: "Cliente WhatsApp ainda não está pronto." });
  }

  try {
    await client.sendMessage(numberWithCode, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.toString() });
  }
});

// Inicia o servidor e só depois o WhatsApp
app.listen(port, () => {
  console.log("Servidor rodando na porta", port);
  initWhatsApp();
});
