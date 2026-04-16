import * as cron from "node-cron";
import { runCrawler } from "./crawler";

let cronJob: cron.ScheduledTask | null = null;
let isRunning = false;

export function startScheduler() {
  if (cronJob) {
    console.log("[Scheduler] Agendador já está rodando");
    return;
  }

  // Executar a cada hora (00 minutos de cada hora)
  cronJob = cron.schedule("0 * * * *", async () => {
    if (isRunning) {
      console.log("[Scheduler] Crawler já está em execução, pulando ciclo");
      return;
    }

    isRunning = true;
    try {
      console.log("[Scheduler] Iniciando crawler agendado...");
      const result = await runCrawler();
      console.log("[Scheduler] Crawler concluído:", result);
    } catch (error) {
      console.error("[Scheduler] Erro ao executar crawler:", error);
    } finally {
      isRunning = false;
    }
  });

  console.log("[Scheduler] Agendador iniciado - crawler rodará a cada hora");

  // Executar também na inicialização (após 5 segundos)
  setTimeout(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      console.log("[Scheduler] Executando crawler inicial...");
      const result = await runCrawler();
      console.log("[Scheduler] Crawler inicial concluído:", result);
    } catch (error) {
      console.error("[Scheduler] Erro ao executar crawler inicial:", error);
    } finally {
      isRunning = false;
    }
  }, 5000);
}

export function stopScheduler() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log("[Scheduler] Agendador parado");
  }
}

export function isSchedulerRunning(): boolean {
  return cronJob !== null;
}

export async function runCrawlerManually() {
  if (isRunning) {
    throw new Error("Crawler já está em execução");
  }

  isRunning = true;
  try {
    return await runCrawler();
  } finally {
    isRunning = false;
  }
}
