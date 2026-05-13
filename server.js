require("dotenv").config({ path: require("path").join(__dirname, ".env"), override: true });
const express = require("express");
const cookieSession = require("cookie-session");
const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const { google } = require("googleapis");
const compression = require("compression");
const path = require("path");

const app = express();
app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h", etag: true }));

app.use(cookieSession({
  name: "wa_session",
  keys: [process.env.SESSION_SECRET || "webagent-secret-xyz"],
  maxAge: 30 * 24 * 60 * 60 * 1000,
}));

// Passport potřebuje tyto metody z express-session
app.use((req, res, next) => {
  if (req.session && !req.session.regenerate) req.session.regenerate = (cb) => cb();
  if (req.session && !req.session.save) req.session.save = (cb) => cb();
  next();
});

app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  process.env.APP_URL + "/auth/google/callback",
  scope: ["profile", "email", "https://www.googleapis.com/auth/gmail.send"],
}, (accessToken, refreshToken, profile, done) => {
  done(null, { accessToken, refreshToken, profile });
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ── Auth routes ──
app.get("/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email", "https://www.googleapis.com/auth/gmail.send"],
    accessType: "offline",
    prompt: "consent",
  })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/?error=login" }),
  (req, res) => res.redirect("/")
);

app.get("/auth/logout", (req, res) => {
  req.logout(() => res.redirect("/"));
});

app.get("/auth/me", (req, res) => {
  if (!req.isAuthenticated()) return res.json({ loggedIn: false });
  res.json({
    loggedIn: true,
    name:  req.user.profile.displayName,
    email: req.user.profile.emails[0].value,
    photo: req.user.profile.photos[0]?.value,
  });
});

// ── Send route ──
function buildHtmlEmail(type, senderName, clientName, projectName, websiteUrl, note) {
  const isDemo = type === "demo";
  const firstName = clientName.split(" ")[0];

  const banner = isDemo
    ? { emoji: "👀", title: "Ukázka vašeho webu", subtitle: `První náhled — ${projectName}`, bg: "linear-gradient(135deg,#0f766e 0%,#7c3aed 100%)" }
    : { emoji: "🚀", title: "Váš web je živý!",   subtitle: projectName,                    bg: "linear-gradient(135deg,#1a56e8 0%,#7c3aed 50%,#e63946 100%)" };

  const bodyText = isDemo
    ? `připravili jsme pro vás první ukázku webu <strong>${projectName}</strong>. Jde o úvodní verzi, která slouží k odsouhlasení designu a struktury stránky před finálním dokončením.<br><br>Prohlédněte si ji a dejte nám vědět, co byste rádi upravili nebo změnili.`
    : `těší nás, že vám můžeme oznámit, že váš web <strong>${projectName}</strong> je hotový a plně spuštěný. Stránka je otestována, funkční a připravena přijímat návštěvníky.<br><br>Pokud budete mít jakékoliv dotazy nebo požadavky na drobné úpravy, neváhejte nás kdykoliv kontaktovat.`;

  const cta = isDemo ? "👁 &nbsp;Zobrazit ukázku" : "🌐 &nbsp;Otevřít web";

  const boxes = isDemo
    ? `<td width="48%" style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:24px;margin-bottom:6px">💬</div>
        <p style="margin:0;color:#134e4a;font-size:13px;font-weight:600">Zpětná vazba</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:12px">Pošlete nám připomínky</p>
      </td><td width="4%"></td>
      <td width="48%" style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:24px;margin-bottom:6px">🎨</div>
        <p style="margin:0;color:#6b21a8;font-size:13px;font-weight:600">Návrh designu</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:12px">K odsouhlasení</p>
      </td>`
    : `<td width="48%" style="background:#f8faff;border:1px solid #e0e7ff;border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:24px;margin-bottom:6px">✅</div>
        <p style="margin:0;color:#3730a3;font-size:13px;font-weight:600">Otestováno</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:12px">Web funguje správně</p>
      </td><td width="4%"></td>
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

  const subject = isDemo
    ? `👀 Ukázka vašeho webu „${projectName}" je připravena`
    : `🚀 Váš web „${projectName}" je hotový!`;

  const html = `<!DOCTYPE html><html lang="cs"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px">
  <tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
    <tr><td style="background:${banner.bg};border-radius:16px 16px 0 0;padding:48px 40px;text-align:center">
      <div style="font-size:52px;margin-bottom:12px">${banner.emoji}</div>
      <h1 style="margin:0;color:#fff;font-size:28px;font-weight:800">${banner.title}</h1>
      <p style="margin:10px 0 0;color:rgba(255,255,255,0.85);font-size:16px">${banner.subtitle}</p>
    </td></tr>
    <tr><td style="background:#fff;padding:40px">
      <p style="margin:0 0 20px;color:#111827;font-size:18px;font-weight:700">Dobrý den, ${firstName} 👋</p>
      <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.7">${bodyText}</p>
      ${noteSection}
      <table cellpadding="0" cellspacing="0" style="margin:32px auto">
        <tr><td style="background:${banner.bg};border-radius:10px">
          <a href="${websiteUrl}" target="_blank" style="display:inline-block;padding:15px 40px;color:#fff;font-size:16px;font-weight:700;text-decoration:none">${cta}</a>
        </td></tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0"><tr>${boxes}</tr></table>
    </td></tr>
    <tr><td style="background:#1e293b;border-radius:0 0 16px 16px;padding:28px 40px;text-align:center">
      <p style="margin:0 0 6px;color:rgba(255,255,255,0.9);font-size:14px;font-weight:600">Odesílatel: ${senderName}</p>
      <p style="margin:0;color:rgba(255,255,255,0.4);font-size:12px">V případě dotazů odpovězte na tento e-mail.</p>
    </td></tr>
  </table></td></tr>
</table></body></html>`;

  return { html, subject };
}

app.post("/send", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Nejsi přihlášen." });

  const { type, clientName, clientEmail, projectName, websiteUrl, note } = req.body;
  if (!clientName || !clientEmail || !projectName || !websiteUrl || !type) {
    return res.status(400).json({ error: "Vyplňte všechna povinná pole." });
  }

  const { accessToken, profile } = req.user;
  const senderName  = profile.displayName;
  const senderEmail = profile.emails[0].value;

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: "v1", auth });
  const { html, subject } = buildHtmlEmail(type, senderName, clientName, projectName, websiteUrl, note);

  const raw = [
    `From: "${senderName}" <${senderEmail}>`,
    `To: ${clientEmail}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
  ].join("\r\n");

  const encoded = Buffer.from(raw).toString("base64url");

  try {
    await gmail.users.messages.send({ userId: "me", requestBody: { raw: encoded } });
    res.json({ success: true, message: "E-mail byl úspěšně odeslán." });
  } catch (err) {
    console.error(err);
    const msg = err.code === 401
      ? "Platnost přihlášení vypršela. Odhlaste se a přihlaste znovu."
      : "Nepodařilo se odeslat e-mail. Zkuste to znovu.";
    res.status(500).json({ error: msg });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server běží na http://localhost:${PORT}`));
