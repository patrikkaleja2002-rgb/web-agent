require("dotenv").config({ path: require("path").join(__dirname, ".env"), override: true });
const express = require("express");
const nodemailer = require("nodemailer");
const compression = require("compression");
const path = require("path");

const app = express();
app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: "1h",
  etag: true,
}));

function buildEmail(type, senderName, clientName, projectName, websiteUrl, note) {
  const isDemo = type === "demo";
  const firstName = clientName.split(" ")[0];

  const banner = isDemo
    ? { emoji: "👀", title: "Ukázka vašeho webu", subtitle: `První náhled — ${projectName}`, bg: "linear-gradient(135deg,#0f766e 0%,#7c3aed 100%)" }
    : { emoji: "🚀", title: "Váš web je živý!",   subtitle: projectName,                    bg: "linear-gradient(135deg,#1a56e8 0%,#7c3aed 50%,#e63946 100%)" };

  const bodyText = isDemo
    ? `připravili jsme pro vás první ukázku webu <strong>${projectName}</strong>. Jde o úvodní verzi, která slouží k odsouhlasení designu a struktury stránky před finálním dokončením.<br><br>Prohlédněte si ji a dejte nám vědět, co byste rádi upravili nebo změnili — vaše zpětná vazba nám pomůže dotáhnout vše přesně podle vašich představ.`
    : `těší nás, že vám můžeme oznámit, že váš web <strong>${projectName}</strong> je hotový a plně spuštěný. Stránka je otestována, funkční a připravena přijímat návštěvníky.<br><br>Pokud budete mít jakékoliv dotazy nebo požadavky na drobné úpravy, neváhejte nás kdykoliv kontaktovat.</p>`;

  const cta = isDemo ? "👁 &nbsp;Zobrazit ukázku" : "🌐 &nbsp;Otevřít web";

  const boxes = isDemo
    ? `<td width="48%" style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:24px;margin-bottom:6px">💬</div>
        <p style="margin:0;color:#134e4a;font-size:13px;font-weight:600">Zpětná vazba</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:12px">Pošlete nám připomínky</p>
      </td>
      <td width="4%"></td>
      <td width="48%" style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:24px;margin-bottom:6px">🎨</div>
        <p style="margin:0;color:#6b21a8;font-size:13px;font-weight:600">Návrh designu</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:12px">Úvodní verze k odsouhlasení</p>
      </td>`
    : `<td width="48%" style="background:#f8faff;border:1px solid #e0e7ff;border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:24px;margin-bottom:6px">✅</div>
        <p style="margin:0;color:#3730a3;font-size:13px;font-weight:600">Otestováno</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:12px">Web funguje správně</p>
      </td>
      <td width="4%"></td>
      <td width="48%" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:24px;margin-bottom:6px">📱</div>
        <p style="margin:0;color:#166534;font-size:13px;font-weight:600">Mobilní verze</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:12px">Funguje na všech zařízeních</p>
      </td>`;

  const noteSection = note
    ? `<div style="margin-top:20px;padding:16px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0">
        <p style="margin:0;color:#92400e;font-size:14px"><strong>📝 Poznámka:</strong> ${note}</p>
      </div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

      <tr><td style="background:${banner.bg};border-radius:16px 16px 0 0;padding:48px 40px;text-align:center">
        <div style="font-size:52px;margin-bottom:12px">${banner.emoji}</div>
        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px">${banner.title}</h1>
        <p style="margin:10px 0 0;color:rgba(255,255,255,0.85);font-size:16px">${banner.subtitle}</p>
      </td></tr>

      <tr><td style="background:#ffffff;padding:40px">
        <p style="margin:0 0 20px;color:#111827;font-size:18px;font-weight:700">Dobrý den, ${firstName} 👋</p>
        <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.7">
          ${bodyText}
        </p>
        ${noteSection}

        <table cellpadding="0" cellspacing="0" style="margin:32px auto">
          <tr><td align="center" style="background:${banner.bg};border-radius:10px">
            <a href="${websiteUrl}" target="_blank"
               style="display:inline-block;padding:15px 40px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none">
              ${cta}
            </a>
          </td></tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>${boxes}</tr>
        </table>
      </td></tr>

      <tr><td style="background:#1e293b;border-radius:0 0 16px 16px;padding:28px 40px;text-align:center">
        <p style="margin:0 0 6px;color:rgba(255,255,255,0.9);font-size:14px;font-weight:600">Odesílatel: ${senderName}</p>
        <p style="margin:0;color:rgba(255,255,255,0.4);font-size:12px">V případě dotazů odpovězte na tento e-mail.</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  const subject = isDemo
    ? `👀 Ukázka vašeho webu „${projectName}" je připravena`
    : `🚀 Váš web „${projectName}" je hotový!`;

  return { html, subject };
}

app.post("/send", async (req, res) => {
  const { senderName, senderEmail, appPassword, clientName, clientEmail, projectName, websiteUrl, type, note } = req.body;

  if (!senderName || !senderEmail || !appPassword || !clientName || !clientEmail || !projectName || !websiteUrl || !type) {
    return res.status(400).json({ error: "Vyplňte všechna povinná pole." });
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: senderEmail, pass: appPassword },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });

  const { html, subject } = buildEmail(type, senderName, clientName, projectName, websiteUrl, note);

  try {
    await transporter.verify();
    await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: clientEmail,
      subject,
      html,
      text: `Dobrý den, ${clientName},\n\n${type === "demo" ? `připravili jsme ukázku webu ${projectName}` : `váš web ${projectName} je hotový`}.\n\n${websiteUrl}${note ? "\n\nPoznámka: " + note : ""}`,
    });
    res.json({ success: true, message: "E-mail byl úspěšně odeslán." });
  } catch (err) {
    console.error(err);
    let msg = "Nepodařilo se odeslat e-mail.";
    if (err.code === "EAUTH" || err.responseCode === 535 || err.responseCode === 534) {
      msg = "Špatný Gmail nebo App Password. Zkontroluj přihlašovací údaje a zkus znovu.";
    } else if (err.code === "ECONNECTION" || err.code === "ETIMEDOUT") {
      msg = "Nepodařilo se připojit k Gmailu. Zkontroluj internetové připojení.";
    } else if (err.responseCode === 550 || err.responseCode === 553) {
      msg = "E-mailová adresa klienta neexistuje nebo je neplatná.";
    }
    res.status(500).json({ error: msg });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server běží na http://localhost:${PORT}`));
