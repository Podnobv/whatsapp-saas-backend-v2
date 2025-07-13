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

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

let lastQr = null;

client.on("qr", async (qr) => {
  console.log("QR RECEBIDO");
  lastQr = await qrcode.toDataURL(qr);
});

client.on("ready", () => {
  console.log("Cliente WhatsApp está pronto!");
});

client.on("message", async (msg) => {
  const agora = new Date();
  const hora = agora.getHours();

  // Configuração do horário da escola
  const inicioAtendimento = 8;
  const fimAtendimento = 18;

  const foraDoHorario = hora < inicioAtendimento || hora >= fimAtendimento;

  if (foraDoHorario) {
    await client.sendMessage(
      msg.from,
      "Olá! Agora estamos fora do horário de atendimento. Em breve responderemos assim que possível!"
    );
  }
});

app.get("/generate-qr", async (req, res) => {
  if (lastQr) {
    res.send(`<img src="${lastQr}" alt="QR Code"/>`);
  } else {
    res.send("AGUARDANDO QR CODE...");
  }
});

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

app.get("/", (req, res) => {
  res.send("Servidor WhatsApp SaaS está rodando.");
});

app.listen(port, () => {
  console.log("Servidor rodando na porta", port);
});
