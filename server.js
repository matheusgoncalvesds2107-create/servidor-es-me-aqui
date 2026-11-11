
const express = require("express");
const { PassThrough } = require("stream");

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT || 3000;
const RADIO_NAME = "Rádio És-me Aqui";
const SERVICE_NAME = "servidor-es-me-aqui";
const SOURCE_KEY = process.env.SOURCE_KEY || "TROQUE-ESTA-CHAVE";

const listeners = new Set();
let sourceConnected = false;
let currentTrack = null;
let totalBytes = 0;

app.get("/", (req, res) => {
  res.json({
    status: "online",
    radio: RADIO_NAME,
    service: SERVICE_NAME
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    radio: RADIO_NAME,
    service: SERVICE_NAME,
    sourceConnected,
    listeners: listeners.size,
    receivingAudio: sourceConnected,
    currentTrack,
    totalBytes
  });
});

app.get("/api/now-playing", (req, res) => {
  res.json({
    radio: RADIO_NAME,
    currentTrack,
    listeners: listeners.size
  });
});

app.get("/stream", (req, res) => {
  res.set({
    "Content-Type": "audio/mpeg",
    "Cache-Control": "no-cache",
    "Access-Control-Allow-Origin": "*"
  });

  res.flushHeaders();

  const client = new PassThrough();
  listeners.add(client);
  client.pipe(res);

  const cleanup = () => {
    listeners.delete(client);
    client.destroy();
  };

  req.on("close", cleanup);
  res.on("close", cleanup);
});

app.post("/source", (req, res) => {
  const key = req.get("x-source-key") || req.query.key;

  if (key !== SOURCE_KEY) {
    return res.status(401).json({
      ok: false,
      error: "Chave inválida"
    });
  }

  if (sourceConnected) {
    return res.status(409).json({
      ok: false,
      error: "Já existe uma transmissão conectada"
    });
  }

  sourceConnected = true;

  res.status(200);
  res.set("Content-Type", "application/json");
  res.write(JSON.stringify({
    ok: true,
    message: "Transmissão conectada",
    radio: RADIO_NAME
  }) + "\n");

  req.on("data", chunk => {
    totalBytes += chunk.length;

    for (const client of listeners) {
      if (!client.destroyed) {
        client.write(chunk);
      }
    }
  });

  const finish = () => {
    sourceConnected = false;
  };

  req.on("end", finish);
  req.on("close", finish);
  req.on("error", finish);
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Rota não encontrada"
  });
});

app.listen(PORT, () => {
  console.log(`${RADIO_NAME} ativo na porta ${PORT}`);
});
