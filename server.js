const express = require("express");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function buildHtmlEmail(clientName, projectName, websiteUrl, message) {
  const messageHtml = message
    .split("\n")
    .map(l => l.trim() ? `<p style="margin:0 0 12px 0;color:#374151;font-size:16px;line-height:1.6">${l}</p>` : "<br>")
    .join("");

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

      <!-- BANNER -->
      <tr><td style="background:linear-gradient(135deg,#1a56e8 0%,#7c3aed 50%,#e63946 100%);border-radius:16px 16px 0 0;padding:48px 40px;text-align:center">
        <div style="font-size:48px;margin-bottom:12px">🚀</div>
        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px">Váš web je živý!</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:16px">${projectName}</p>
      </td></tr>

      <!-- BODY -->
      <tr><td style="background:#ffffff;padding:40px">

        <!-- Pozdrav -->
        <p style="margin:0 0 24px;color:#111827;font-size:18px;font-weight:700">Dobrý den, ${clientName} 👋</p>

        <!-- Zpráva -->
        <div style="margin-bottom:32px">
          ${messageHtml}
        </div>

        <!-- Tlačítko -->
        <table cellpadding="0" cellspacing="0" style="margin:0 auto 36px">
          <tr><td align="center" style="background:linear-gradient(135deg,#1a56e8,#7c3aed);border-radius:10px">
            <a href="${websiteUrl}" target="_blank"
               style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:0.3px">
              🌐 &nbsp;Otevřít web
            </a>
          </td></tr>
        </table>

        <!-- Info boxy -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="48%" style="background:#f8faff;border:1px solid #e0e7ff;border-radius:10px;padding:16px;text-align:center">
              <div style="font-size:24px;margin-bottom:6px">✅</div>
              <p style="margin:0;color:#3730a3;font-size:13px;font-weight:600">Otestováno</p>
              <p style="margin:4px 0 0;color:#6b7280;font-size:12px">Web funguje správně</p>
            </td>
            <td width="4%"></td>
            <td width="48%" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;text-align:center">
              <div style="font-size:24px;margin-bottom:6px">📱</div>
              <p style="margin:0;color:#166534;font-size:13px;font-weight:600">Mobilní verze</p>
              <p style="margin:4px 0 0;color:#6b7280;font-size:12px">Funguje na všech zařízeních</p>
            </td>
          </tr>
        </table>

      </td></tr>

      <!-- FOOTER -->
      <tr><td style="background:#1e293b;border-radius:0 0 16px 16px;padding:28px 40px;text-align:center">
        <p style="margin:0 0 8px;color:rgba(255,255,255,0.9);font-size:14px;font-weight:600">Web Studio</p>
        <p style="margin:0;color:rgba(255,255,255,0.45);font-size:12px">Tento e-mail byl odeslán automaticky. V případě dotazů odpovězte na tento e-mail.</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

app.post("/send", async (req, res) => {
  const { senderEmail, appPassword, clientName, clientEmail, projectName, websiteUrl, message } = req.body;

  if (!senderEmail || !appPassword || !clientName || !clientEmail || !projectName || !websiteUrl || !message) {
    return res.status(400).json({ error: "Vyplňte všechna povinná pole." });
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: senderEmail,
      pass: appPassword,
    },
  });

  try {
    await transporter.sendMail({
      from: `"Web Studio" <${senderEmail}>`,
      to: clientEmail,
      subject: `🚀 Váš web „${projectName}" je hotový!`,
      html: buildHtmlEmail(clientName, projectName, websiteUrl, message),
      text: `${message}\n\nWeb: ${websiteUrl}`,
    });

    res.json({ success: true, message: "E-mail byl úspěšně odeslán." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Chyba při odesílání e-mailu: " + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server běží na http://localhost:${PORT}`);
});
