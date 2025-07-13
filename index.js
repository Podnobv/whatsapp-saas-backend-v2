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

// ⚙️ CONFIGURAÇÕES DO CHATBOT
let chatbotConfig = {
  horarioFuncionamento: {
    segunda: { abre: "08:00", fecha: "18:00" },
    terca:   { abre: "08:00", fecha: "18:00" },
    quarta:  { abre: "08:00", fecha: "18:00" },
    quinta:  { abre: "08:00", fecha: "18:00" },
    sexta:   { abre: "08:00", fecha: "18:00" },
    sabado:  { abre: "09:00", fecha: "13:00" },
    domingo: { abre: null, fecha: null } // fechado
  },
  tempoSemRespostaMin: 10,
  mensagemAutomatica: "Olá! Em breve nossa equipe retornará. Se preferir, envie seu nome, curso de interesse e melhor horário para contato 😊"
};

let mensagensPendentes = {}; // Controle de tempo sem resposta

// 🟢 CLIENT WHATSAPP
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.initialize();

let lastQr = null;

client.on("qr", async (qr) => {
  console.log("QR RECEBIDO");
  lastQr = await qrcode.toDataURL(qr);
});

client.on("ready", () => {
  console.log("✅ Cliente WhatsApp conectado com sucesso!");
});

client.on("message", async (msg) => {
  const numero = msg.from;

  // Verifica se é uma mensagem de grupo
  if (numero.includes("-")) return;

  const agora = new Date();
  const diaSemana = agora.toLocaleDateString("pt-BR", { weekday: "long" }).toLowerCase();
  const horario = agora.toTimeString().slice(0, 5);

  const horarioDia = chatbotConfig.horarioFuncionamento[diaSemana] || {}
