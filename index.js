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
    args: ['--no-sandbox'],
  },
});

client.on("qr", async (qr) => {
  const qrCodeImageUrl = await qrcode.toDataURL(qr);
  fs.writeFileSync("./last-qrcode.txt", qrCodeImageUrl);
  console.log("🔁 Novo QR Code gerado.");
});

client.on("ready", () => {
  console.log("✅ Cliente WhatsApp está pronto!");
  fs.writeFileSync("./status.txt", "CONNECTED");
});

client.on("disconnected", () => {
  console.log("❌ Cliente desconectado.");
  fs.writeFileSync("./status.txt", "DISCONNECTED");
});

client.initialize();

// Rota inicial
app.get("/", (req, res) => {
  res.send("Servidor WhatsApp SaaS está rodando.");
});

// Rota para obter QR Code atual
app.get("/generate-qr", async (req, res) => {
  try {
    if (fs.existsSync("./last-qrcode.txt")) {
      const qrData = fs.readFileSync("./last-qrcode.txt", "utf8");
      return res.json({ qr: qrData });
    } else {
      return res.status(404).json({ error: "QR Code ainda não gerado." });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Rota para verificar status de conexão
app.get("/status", (req, res) => {
  if (fs.existsSync("./status.txt")) {
    const status = fs.readFileSync("./status.txt", "utf8");
    return res.json({ status });
  } else {
    return res.json({ status: "LOADING" });
  }
});

// Rota para envio de mensagem
app.post("/send-message", async (req, res) => {
  const { number, message } = req.body;
  const fullNumber = number + "@c.us";

  try {
    await client.sendMessage(fullNumber, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.toString() });
  }
});

app.listen(port, () => {
  console.log("Servidor rodando na porta", port);
});
