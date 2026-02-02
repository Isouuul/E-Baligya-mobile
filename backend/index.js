import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import ocrRoute from './ocr.js';
dotenv.config();


const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/ocr', ocrRoute);



// ----------------- Reusable function -----------------
const sendEmail = async ({ to, subject, text }) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  });
};
// -----------------------------------------------------

app.post('/send-email', async (req, res) => {
  const { to, subject, text } = req.body;

  try {
    await sendEmail({ to, subject, text }); // <-- use the function
    res.send({ success: true });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// ----------------- OTP Functionality -----------------
const otpStore = {}; // temporary storage for OTPs

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).send({ error: 'Email is required' });

  const otp = generateOTP();
  otpStore[email] = otp; // store OTP temporarily

  try {
    await sendEmail({
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP code is: ${otp}`,
    });
    res.send({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).send({ error: 'Email and OTP required' });

  if (otpStore[email] === otp) {
    delete otpStore[email]; // remove OTP after verification
    return res.send({ success: true, message: 'OTP verified!' });
  } else {
    return res.status(400).send({ success: false, message: 'Invalid OTP' });
  }
});
// -----------------------------------------------------

app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));
