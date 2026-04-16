const ACCESSORY_KEYWORDS =
  /ventoinha|resfriamento|refrigera|controle|dualsense|headset|fone|cabo|carregador|suporte|capa|película|base|stand|unidade de disco|jogo|game|skin|protetor|compatível|cooler|cooling|fan\b/;

export function isPS5ProConsole(titleLower: string): boolean {
  const hasPS5Pro =
    titleLower.includes("ps5 pro") ||
    titleLower.includes("playstation 5 pro") ||
    titleLower.includes("playstation5 pro") ||
    titleLower.includes("playstation®5 pro");

  const isAccessory = ACCESSORY_KEYWORDS.test(titleLower);

  return hasPS5Pro && !isAccessory;
}
