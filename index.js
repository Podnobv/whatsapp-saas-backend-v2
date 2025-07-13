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
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  }
});

let qrCodeImage = null;
let isReady = false;

client.on("qr", (qr) => {
  qrcode.toDataURL(qr, (err, url) => {
    qrCodeImage = url;
  });
});

client.on("ready", () => {
  console.log("✅ Cliente WhatsApp pronto");
  isReady = true;
});

client.on("disconnected", () => {
  console.log("❌ Cliente desconectado");
  isReady = false;
});

client.initialize();

app.get("/", (req, res) => {
  res.send("🚀 Backend do WhatsApp SaaS está rodando.");
});

app.get("/generate-qr", (req, res) => {
  if (qrCodeImage) {
    res.send(`<img src="${qrCodeImage}" alt="QR Code WhatsApp" />`);
  } else if (isReady) {
    res.send("✅ WhatsApp já conectado.");
  } else {
    res.send("⏳ Aguardando geração do QR Code...");
  }
});

app.post("/send-message", async (req, res) => {
  const { number, message } = req.body;
  if (!number || !message) {
    return res.status(400).json({ error: "Número e mensagem são obrigatórios" });
  }

  try {
    const sanitizedNumber = number.includes("@c.us") ? number : `${number}@c.us`;
    await client.sendMessage(sanitizedNumber, message);
    res.json({ success: true, message: "Mensagem enviada com sucesso" });
  } catch (err) {
    console.error("Erro ao enviar mensagem:", err);
    res.status(500).json({ error: "Falha ao enviar mensagem" });
  }
});

app.post("/send-media", async (req, res) => {
  const { number } = req.body;
  if (!req.files || !req.files.media || !number) {
    return res.status(400).json({ error: "Arquivo de mídia e número são obrigatórios" });
  }

  const mediaFile = req.files.media;
  const filePath = __dirname + "/" + mediaFile.name;

  await mediaFile.mv(filePath);
  const mimetype = mime.lookup(filePath);
  const media = require("whatsapp-web.js").MessageMedia.fromFilePath(filePath);

  try {
    const sanitizedNumber = number.includes("@c.us") ? number : `${number}@c.us`;
    await client.sendMessage(sanitizedNumber, media);
    fs.unlinkSync(filePath);
    res.json({ success: true, message: "Mídia enviada com sucesso" });
  } catch (err) {
    fs.unlinkSync(filePath);
    console.error("Erro ao enviar mídia:", err);
    res.status(500).json({ error: "Falha ao enviar mídia" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
