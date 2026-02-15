import "dotenv/config";
import express from "express";
import nodemailer from "nodemailer";

const app = express();
app.use(express.json());

const EMAIL_SERVER_PORT = Number(process.env.EMAIL_SERVER_PORT || 8081);
const FIXED_TO_ADDRESS = process.env.FIXED_TO_ADDRESS || "sohamjagushte2@gmail.com";

const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  from: process.env.SMTP_FROM || process.env.SMTP_USER,
};

const hasMissingSmtpConfig = () => {
  return !smtpConfig.host || !smtpConfig.auth.user || !smtpConfig.auth.pass || !smtpConfig.from;
};

app.post("/api/send-intervention", async (req, res) => {
  if (hasMissingSmtpConfig()) {
    return res.status(500).send("Missing SMTP configuration in .env");
  }

  const {
    customerId,
    customerName,
    topSignal,
    selectedIntervention,
    officerNotes,
  } = req.body || {};

  if (!customerId || !customerName || !topSignal || !selectedIntervention) {
    return res.status(400).send("Missing required email fields");
  }

  const subject = `Support Options Available — ${customerId}`;
  const text = [
    `Dear ${customerName},`,
    "",
    "We have noticed some changes in your financial activity and would like to offer support.",
    `Our analysis indicates potential financial stress signals related to ${String(topSignal).toLowerCase()}.`,
    "",
    `We would like to offer you the following support option: ${selectedIntervention}.`,
    "",
    "Please contact your relationship manager to discuss this further.",
    "We are here to help you manage your finances effectively.",
    "",
    "Kind regards,",
    "Financial Support Team",
    officerNotes ? "" : undefined,
    officerNotes ? `Officer Notes: ${officerNotes}` : undefined,
  ].filter(Boolean).join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
      <p>Dear ${customerName},</p>
      <p>
        We have noticed some changes in your financial activity and would like to offer support.
        Our analysis indicates potential financial stress signals related to
        <strong>${String(topSignal).toLowerCase()}</strong>.
      </p>
      <p>
        We would like to offer you the following support option:
        <strong>${selectedIntervention}</strong>.
      </p>
      <p>
        Please contact your relationship manager to discuss this further.
        We are here to help you manage your finances effectively.
      </p>
      <p>Kind regards,<br />Financial Support Team</p>
      ${officerNotes ? `<p><strong>Officer Notes:</strong> ${officerNotes}</p>` : ""}
    </div>
  `.trim();

  try {
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure || smtpConfig.port === 465,
      auth: smtpConfig.auth,
    });

    const info = await transporter.sendMail({
      from: smtpConfig.from,
      to: FIXED_TO_ADDRESS,
      subject,
      text,
      html,
    });

    return res.json({ messageId: info.messageId, to: FIXED_TO_ADDRESS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP send failed";
    return res.status(500).send(message);
  }
});

app.listen(EMAIL_SERVER_PORT, () => {
  console.log(`Email server listening on ${EMAIL_SERVER_PORT}`);
});
