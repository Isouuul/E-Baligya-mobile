import express from 'express';
import multer from 'multer';
import Tesseract from 'tesseract.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/scan-id', upload.single('image'), async (req, res) => {
  try {
    const result = await Tesseract.recognize(
      req.file.path,
      'eng'
    );

    res.json({
      success: true,
      text: result.data.text,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});



export default router;
