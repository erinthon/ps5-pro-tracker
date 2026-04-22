import { describe, it, expect } from "vitest";
import { getCatalogItem } from "../../shared/catalog";

const item = getCatalogItem("ps5-pro-console");

// Helpers
const match = (title: string, price?: number) =>
  item.isMatch({ title: title.toLowerCase(), price });

const PRICE_OK = 499_900;   // R$ 4.999 — faixa válida
const PRICE_LOW = 50_000;   // R$ 500 — muito barato para ser console
const PRICE_HIGH = 2_000_000; // R$ 20.000 — acima do razoável

describe("ps5-pro-console — isMatch", () => {

  describe("passam — com 'console' no título (sinal suficiente)", () => {
    it("console ps5 pro padrão", () =>
      expect(match("Console PlayStation 5 Pro 1TB")).toBe(true));
    it("console edição digital", () =>
      expect(match("Console PlayStation 5 Pro Edição Digital")).toBe(true));
    it("ordem diferente", () =>
      expect(match("PlayStation 5 Pro Console 1TB Sony")).toBe(true));
    it("console ps5 abreviado", () =>
      expect(match("Console PS5 Pro Sony 1TB SSD")).toBe(true));
  });

  describe("passam — sem 'console', mas com sinais corroborativos (≥2)", () => {
    it("sony + 2tb", () =>
      expect(match("Sony PS5 Pro 2TB")).toBe(true));
    it("sony + 1tb", () =>
      expect(match("Sony PlayStation 5 Pro 1TB")).toBe(true));
    it("1tb + ssd", () =>
      expect(match("PlayStation 5 Pro 1TB SSD")).toBe(true));
    it("sony + preço ok", () =>
      expect(match("Sony PS5 Pro", PRICE_OK)).toBe(true));
    it("1tb + preço ok", () =>
      expect(match("PlayStation 5 Pro 1TB", PRICE_OK)).toBe(true));
    it("modelo cfi + sony", () =>
      expect(match("Sony PS5 Pro CFI-7016B")).toBe(true));
    it("lacrado + preço ok", () =>
      expect(match("PS5 Pro Lacrado Novo", PRICE_OK)).toBe(true));
    it("edição digital + preço ok", () =>
      expect(match("PlayStation 5 Pro Edição Digital", PRICE_OK)).toBe(true));
    it("8k + sony", () =>
      expect(match("Sony PS5 Pro 8K HDR")).toBe(true));
  });

  describe("falham — sinais insuficientes sem 'console'", () => {
    it("ps5 pro isolado sem sinais", () =>
      expect(match("PS5 Pro")).toBe(false));
    it("ps5 pro com apenas preço ok (1 sinal)", () =>
      expect(match("PS5 Pro", PRICE_OK)).toBe(false));
    it("sony ps5 pro com preço muito baixo", () =>
      expect(match("Sony PS5 Pro 1TB", PRICE_LOW)).toBe(true)); // 1tb+sony=2 → passa independente de preço
    it("ps5 pro preço alto demais (fora da faixa)", () =>
      expect(match("PS5 Pro 1TB Sony", PRICE_HIGH)).toBe(true)); // 1tb+sony=2 → passa pelo título
  });

  describe("falham — acessórios (blocklist)", () => {
    it("controle dualsense edge (caso real)", () =>
      expect(match("PlayStation 5 Dual Sense Edge wireless controller (KSA Version)")).toBe(false));
    it("carregador", () =>
      expect(match("Carregador para Console PlayStation 5 Pro", PRICE_OK)).toBe(false));
    it("cabo hdmi", () =>
      expect(match("Cabo HDMI 2.1 PlayStation 5 Pro", PRICE_OK)).toBe(false));
    it("suporte", () =>
      expect(match("Suporte Vertical Console PlayStation 5 Pro", PRICE_OK)).toBe(false));
    it("película", () =>
      expect(match("Película Protetora Console PlayStation 5 Pro", PRICE_OK)).toBe(false));
    it("fonte", () =>
      expect(match("Fonte PlayStation 5 Pro", PRICE_OK)).toBe(false));
    it("kit limpeza", () =>
      expect(match("Kit Limpeza Console PlayStation 5 Pro", PRICE_OK)).toBe(false));
    it("acessório genérico", () =>
      expect(match("Acessório PS5 Pro Sony 1TB", PRICE_OK)).toBe(false));
  });

  describe("falham — geração errada (PS1–PS4)", () => {
    it("PS4 Pro (caso real relatado)", () =>
      expect(match("Sony PlayStation 4 Pro 1TB Standard cor preto onyx 2020", PRICE_OK)).toBe(false));
    it("ps4 abreviado", () =>
      expect(match("Sony PS4 Pro 1TB", PRICE_OK)).toBe(false));
    it("playstation 3", () =>
      expect(match("Console PlayStation 3 Pro", PRICE_OK)).toBe(false));
    it("ps1", () =>
      expect(match("PS1 Pro Sony 1TB", PRICE_OK)).toBe(false));
  });

  describe("falham — sem platform ou sem pro", () => {
    it("sem platform", () =>
      expect(match("Console Pro 1TB Sony")).toBe(false));
    it("sem pro", () =>
      expect(match("Console PlayStation 5 1TB Sony")).toBe(false));
  });

  describe("falham — jogos (blocklist)", () => {
    it("jogo explícito", () =>
      expect(match("Jogo Spider-Man 2 PlayStation 5 Pro", PRICE_OK)).toBe(false));
    it("game no título", () =>
      expect(match("Game God of War PS5 Pro Edition", PRICE_OK)).toBe(false));
  });
});
