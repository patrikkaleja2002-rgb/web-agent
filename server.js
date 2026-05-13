const express = require("express");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

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

  const emailBody = `${message}

---
Web: ${websiteUrl}`;

  try {
    await transporter.sendMail({
      from: `"Web Studio" <${senderEmail}>`,
      to: clientEmail,
      subject: `Váš web „${projectName}" je hotový!`,
      text: emailBody,
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
