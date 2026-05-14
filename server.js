// dotenv only for local dev - Railway injects env vars directly
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: require("path").join(__dirname, ".env") });
}
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

app.set("trust proxy", 1);
app.use(cookieSession({
  name: "wa_session",
  keys: [process.env.SESSION_SECRET || "webagent-secret-xyz"],
  maxAge: 30 * 24 * 60 * 60 * 1000,
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
  sameSite: "lax",
}));

// Passport + cookie-session kompatibilita
app.use((req, res, next) => {
  if (req.session && !req.session.regenerate) req.session.regenerate = (cb) => cb();
  if (req.session && !req.session.save) req.session.save = (cb) => cb();
  next();
});

app.use(passport.initialize());
app.use(passport.session());

const CALLBACK_URL = "https://web-agent-production-9053.up.railway.app/auth/google/callback";

try {
  passport.use(new GoogleStrategy({
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  CALLBACK_URL,
  }, (accessToken, refreshToken, profile, done) => {
    done(null, {
      accessToken,
      name:  profile.displayName,
      email: profile.emails?.[0]?.value,
      photo: profile.photos?.[0]?.value,
    });
  }));
  console.log("✅ Google OAuth strategie načtena");
} catch (e) {
  console.error("❌ Chyba při načítání OAuth strategie:", e.message);
}

process.on("uncaughtException", (err) => console.error("Uncaught:", err));
process.on("unhandledRejection", (err) => console.error("Unhandled:", err));

// Serialize: uložíme jen to nejmenší co jde
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ── Health check (pro monitoring) ──
app.get("/health", (req, res) => {
  const ok = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "error",
    time: new Date().toISOString(),
    oauth: ok ? "configured" : "missing env vars",
    uptime: Math.floor(process.uptime()) + "s",
  });
});

// ── Debug ──
app.get("/debug", (req, res) => {
  res.json({
    hasClientId:     !!process.env.GOOGLE_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl:     CALLBACK_URL,
    isAuth:          req.isAuthenticated(),
    uptime:          Math.floor(process.uptime()) + "s",
  });
});

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
  req.session = null;
  res.redirect("/");
});

app.get("/auth/me", (req, res) => {
  if (!req.isAuthenticated()) return res.json({ loggedIn: false });
  res.json({
    loggedIn: true,
    name:  req.user.name,
    email: req.user.email,
    photo: req.user.photo,
  });
});

// ── Email builder ──
function buildHtmlEmail(type, senderName, clientName, projectName, websiteUrl, note, clientPhone) {
  const isDemo = type === "demo";
  const firstName = clientName.split(" ")[0];

  const accentColor = isDemo ? "#2563eb" : "#111827";
  const tagText = isDemo ? "NÁHLED WEBU" : "WEB JE SPUŠTĚN";
  const headline = isDemo ? `Připravili jsme náhled vašeho webu` : `Váš web je připraven`;

  const bodyText = isDemo
    ? `Dobrý den, ${firstName},<br><br>připravili jsme pro vás první náhled webu <strong>${projectName}</strong>. Tato verze slouží k odsouhlasení celkového designu a struktury stránky před finálním dokončením.<br><br>Prohlédněte si ji a sdělte nám případné připomínky nebo změny.`
    : `Dobrý den, ${firstName},<br><br>rádi vám oznamujeme, že web <strong>${projectName}</strong> je dokončen a plně spuštěn. Stránka je otestována a připravena přijímat návštěvníky.<br><br>V případě jakýchkoliv dotazů nebo požadavků na úpravy nás neváhejte kontaktovat.`;

  const ctaText = isDemo ? "Zobrazit náhled webu" : "Otevřít web";

  const noteSection = note
    ? `<tr><td style="padding:0 48px 32px">
        <div style="padding:16px 20px;background:#f8fafc;border-left:3px solid #2563eb;border-radius:0 6px 6px 0">
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.6"><strong style="color:#111827">Poznámka:</strong> ${note}</p>
        </div>
      </td></tr>`
    : "";

  const infoRow = isDemo
    ? `<tr><td style="padding:0 48px 40px">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="48%" style="padding:20px;background:#f8fafc;border-radius:8px;vertical-align:top">
              <p style="margin:0 0 4px;color:#111827;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Zpětná vazba</p>
              <p style="margin:0;color:#6b7280;font-size:13px">Odpovězte na tento e-mail s připomínkami</p>
            </td>
            <td width="4%"></td>
            <td width="48%" style="padding:20px;background:#f8fafc;border-radius:8px;vertical-align:top">
              <p style="margin:0 0 4px;color:#111827;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Ke schválení</p>
              <p style="margin:0;color:#6b7280;font-size:13px">Design a struktura stránky</p>
            </td>
          </tr>
        </table>
      </td></tr>`
    : `<tr><td style="padding:0 48px 40px">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="48%" style="padding:20px;background:#f8fafc;border-radius:8px;vertical-align:top">
              <p style="margin:0 0 4px;color:#111827;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Otestováno</p>
              <p style="margin:0;color:#6b7280;font-size:13px">Web funguje na všech zařízeních</p>
            </td>
            <td width="4%"></td>
            <td width="48%" style="padding:20px;background:#f8fafc;border-radius:8px;vertical-align:top">
              <p style="margin:0 0 4px;color:#111827;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Mobilní verze</p>
              <p style="margin:0;color:#6b7280;font-size:13px">Plně responzivní design</p>
            </td>
          </tr>
        </table>
      </td></tr>`;

  const subject = isDemo
    ? `Náhled webu „${projectName}" je připraven`
    : `Web „${projectName}" je spuštěn`;

  const html = `<!DOCTYPE html><html lang="cs"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:48px 16px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">

      <!-- Header -->
      <tr><td style="background:#111827;padding:36px 48px;border-radius:12px 12px 0 0">
        <p style="margin:0 0 20px;color:rgba(255,255,255,0.4);font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase">${tagText}</p>
        <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;line-height:1.3">${headline}</h1>
        <p style="margin:10px 0 0;color:rgba(255,255,255,0.55);font-size:15px">${projectName}</p>
      </td></tr>

      <!-- Divider line -->
      <tr><td style="background:${accentColor};height:3px;padding:0"></td></tr>

      <!-- Body -->
      <tr><td style="padding:40px 48px 32px">
        <p style="margin:0;color:#374151;font-size:15px;line-height:1.8">${bodyText}</p>
      </td></tr>

      <!-- Note -->
      ${noteSection}

      <!-- CTA Button -->
      <tr><td style="padding:0 48px 40px">
        <table cellpadding="0" cellspacing="0">
          <tr><td style="background:${accentColor};border-radius:6px">
            <a href="${websiteUrl}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.2px">${ctaText}</a>
          </td></tr>
        </table>
      </td></tr>

      <!-- Info boxes -->
      ${infoRow}

      <!-- Footer -->
      <tr><td style="border-top:1px solid #f1f5f9;padding:24px 48px;background:#fafafa;border-radius:0 0 12px 12px">
        <p style="margin:0;color:#9ca3af;font-size:13px">Odesláno od <strong style="color:#6b7280">${senderName}</strong> — odpovězte na tento e-mail v případě dotazů.</p>
        ${clientPhone ? `<p style="margin:8px 0 0;color:#9ca3af;font-size:13px">Tel: <strong style="color:#6b7280">${clientPhone}</strong></p>` : ""}
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

  return { html, subject };
}

// ── Send route ──
app.post("/send", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Nejsi přihlášen." });

  const { type, clientName, clientEmail, projectName, websiteUrl, note, clientPhone } = req.body;
  if (!clientName || !clientEmail || !projectName || !websiteUrl || !type) {
    return res.status(400).json({ error: "Vyplňte všechna povinná pole." });
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: req.user.accessToken });

  const gmail = google.gmail({ version: "v1", auth });
  const { html, subject } = buildHtmlEmail(type, req.user.name, clientName, projectName, websiteUrl, note, clientPhone);

  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
  const encodedName = `=?UTF-8?B?${Buffer.from(req.user.name).toString("base64")}?=`;

  const raw = [
    `From: "${encodedName}" <${req.user.email}>`,
    `To: ${clientEmail}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
  ].join("\r\n");

  try {
    await gmail.users.messages.send({ userId: "me", requestBody: { raw: Buffer.from(raw).toString("base64url") } });
    res.json({ success: true, message: "E-mail byl úspěšně odeslán." });
  } catch (err) {
    const msg = err?.response?.data?.error || err?.message || String(err);
    console.error("GMAIL ERROR:", msg, JSON.stringify(err?.response?.data));
    res.status(500).json({ error: "Chyba: " + msg });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server běží na http://localhost:${PORT}`));
