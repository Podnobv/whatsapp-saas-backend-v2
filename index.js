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

client.initialize();

client.on("qr", async (qr) => {
  console.log("QR RECEBIDO");
  lastQr = await qrcode.toDataURL(qr);
});

client.on("ready", () => {
  console.log("Cliente WhatsApp está pronto!");
});

let lastQr = null;

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
