const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const mime = require("mime-types");
const fs = require("fs");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(fileUpload());

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

let qrCodeData = null;
let isReady = false;

client.on("qr", async (qr) => {
  console.log("QR Code recebido");
  qrCodeData = await qrcode.toDataURL(qr);
  isReady = false;
});

client.on("ready", () => {
  console.log("Cliente está pronto");
  isReady = true;
});

client.on("authenticated", () => {
  console.log("Autenticado com sucesso");
});

client.on("auth_failure", () => {
  console.log("Falha na autenticação");
});

client.on("message", async (message) => {
  console.log("Mensagem recebida:", message.body);
});

client.initialize();

// Rota para gerar QR Code
app.get("/generate-qr", (req, res) => {
  if (isReady) {
    return res.json({ status: "CONNECTED" });
  } else if (qrCodeData) {
    return res.json({ status: "QRCODE", src: qrCodeData });
  } else {
    return res.json({ status: "LOADING" });
  }
});

// Envio de mensagem de texto
app.post("/send-message", async (req, res) => {
  const { number, message } = req.body;
  const numberWithCode = number + "@c.us";

  try {
    await client.sendMessage(numberWithCode, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.toString() });
  }
});

// Início
app.get("/", (req, res) => {
  res.send("Servidor WhatsApp SaaS está rodando.");
});

app.listen(port, () => {
  console.log("Servidor rodando na porta", port);
});
