import { Resend } from "resend";
import { eq } from "drizzle-orm";
import { ENV } from "./env";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";

function formatPrice(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export type PriceDropEmailOpts = {
  title: string;
  url: string;
  storeName: string;
  previousPrice: number;
  newPrice: number;
};

async function getOwnerEmail(): Promise<string | null> {
  if (!ENV.ownerOpenId) return null;
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.openId, ENV.ownerOpenId))
    .limit(1);

  return result[0]?.email ?? null;
}

export async function sendPriceDropEmail(opts: PriceDropEmailOpts): Promise<void> {
  if (!ENV.resendApiKey) return;

  const toEmail = await getOwnerEmail();
  if (!toEmail) {
    console.warn("[Email] E-mail do dono não encontrado — faça login com Google para ativar notificações.");
    return;
  }

  const savings = opts.previousPrice - opts.newPrice;
  const savingsPct = Math.round((savings / opts.previousPrice) * 100);

  const subject = `[PS5 Pro Tracker] Queda de preço na ${opts.storeName}: ${formatPrice(opts.newPrice)}`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;overflow:hidden;max-width:560px;width:100%;">

        <tr>
          <td style="background:linear-gradient(135deg,#6d28d9,#2563eb);padding:24px 32px;">
            <p style="margin:0;color:#e2e8f0;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">PS5 Pro Tracker</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">Queda de preço detectada</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 6px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">${opts.storeName}</p>
            <p style="margin:0 0 24px;color:#f1f5f9;font-size:17px;font-weight:600;line-height:1.4;">${opts.title}</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;border-right:1px solid #1e293b;" width="50%">
                  <p style="margin:0 0 4px;color:#64748b;font-size:12px;">Preço anterior</p>
                  <p style="margin:0;color:#94a3b8;font-size:20px;font-weight:700;text-decoration:line-through;">${formatPrice(opts.previousPrice)}</p>
                </td>
                <td style="padding:20px 24px;" width="50%">
                  <p style="margin:0 0 4px;color:#64748b;font-size:12px;">Novo preço</p>
                  <p style="margin:0;color:#4ade80;font-size:24px;font-weight:800;">${formatPrice(opts.newPrice)}</p>
                </td>
              </tr>
            </table>

            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#14532d;color:#4ade80;font-size:13px;font-weight:700;padding:6px 14px;border-radius:99px;">
                  Economia de ${formatPrice(savings)} (${savingsPct}%)
                </td>
              </tr>
            </table>

            <a href="${opts.url}" style="display:inline-block;background:#6d28d9;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:8px;">
              Ver oferta &rarr;
            </a>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 32px;border-top:1px solid #0f172a;">
            <p style="margin:0;color:#475569;font-size:12px;">Este alerta foi gerado automaticamente pelo PS5 Pro Tracker.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const resend = new Resend(ENV.resendApiKey);

  const { error } = await resend.emails.send({
    from: "PS5 Pro Tracker <onboarding@resend.dev>",
    to: toEmail,
    subject,
    html,
  });

  if (error) {
    console.warn("[Email] Falha ao enviar notificação por e-mail:", error);
  } else {
    console.log(`[Email] Alerta de queda de preço enviado para ${toEmail} (${opts.storeName})`);
  }
}
