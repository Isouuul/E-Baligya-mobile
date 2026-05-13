import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());


const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,         // CHANGED: Use 465 instead of 587
  secure: true,      // CHANGED: Must be true for port 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 30000, 
  greetingTimeout: 30000,
  socketTimeout: 30000,
  tls: {
    rejectUnauthorized: false, 
    minVersion: 'TLSv1.2',
  },
});

// ----------------- Reusable sendEmail Function -----------------
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
      html,
    });
    console.log('Email sent:', info.response);
    return info;
  } catch (err) {
    console.error('Error sending email:', err);
    throw err;
  }
};

transporter.verify((error, success) => {
  if (error) {
    console.error("Email transporter error:", error);
  } else {
    console.log("Email server is ready");
  }
});

// ----------------- Health Check -----------------
app.get('/', (req, res) => {
  res.status(200).json({ message: 'E-Baligya Backend is running', status: 'OK' });
});

// ----------------- OTP Functionality -----------------
const otpStore = {}; // { email: { code, expires } }

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
const OTP_EXPIRATION = 1 * 60 * 1000; // 1 minute

app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).send({ error: 'Email is required' });

  const otp = generateOTP();
  otpStore[email] = {
    code: otp,
    expires: Date.now() + OTP_EXPIRATION,
  };

  try {
await sendEmail({
  to: email,
  subject: 'Your E-Baligya Verification Code',
  text: `Hello,

Your One-Time Password (OTP) for E-Baligya is: ${otp}

This code will expire in 1 minute.
For security reasons, please do not share this code with anyone.

If you did not request this, please ignore this email.

— E-Baligya Team`,
  html: `
    <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
      <div style="max-width: 500px; margin: auto; background: #ffffff; padding: 25px; border-radius: 8px;">
        <h2 style="margin: 0 0 10px 0; color: #2563EB;">E-Baligya</h2>
        <p style="color: #333;">Hello,</p>
        <p style="color: #333;">Your One-Time Password (OTP) is:</p>
        
        <div style="text-align: center; margin: 20px 0;">
          <span style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #2563EB;">
            ${otp}
          </span>
        </div>

        <p style="color: #555;">
            This code will expire in <strong>1 minute</strong>.
        </p>
        <p style="color: #555;">
          For security reasons, please do not share this code with anyone.
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />

        <p style="font-size: 12px; color: #888;">
          If you did not request this email, you can safely ignore it.
        </p>

        <p style="margin-top: 20px; color: #333;">
          — The E-Baligya Team
        </p>
      </div>
    </div>
  `,
});

    res.send({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).send({ error: 'Email and OTP required' });

  const record = otpStore[email];

  if (!record) return res.status(400).send({ success: false, message: 'No OTP found for this email' });
  if (record.expires < Date.now()) {
    delete otpStore[email];
    return res.status(400).send({ success: false, message: 'OTP expired' });
  }

  if (record.code === otp) {
    delete otpStore[email];
    return res.send({ success: true, message: 'OTP verified!' });
  } else {
    return res.status(400).send({ success: false, message: 'Invalid OTP' });
  }
});

// ----------------- Generic Email Sending -----------------
app.post('/send-email', async (req, res) => {
  const { to, subject, text, html } = req.body;
  if (!to || !subject || (!text && !html))
    return res.status(400).send({ error: 'Missing required fields' });

  try {
    await sendEmail({ to, subject, text, html });
    res.send({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// ----------------- Start Server -----------------
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
