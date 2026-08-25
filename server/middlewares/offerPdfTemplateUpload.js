import multer from 'multer';
import path from 'path';

const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10 MB

function pdfFilter(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (file.mimetype === 'application/pdf' || ext === '.pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only PDF files are allowed'));
    }
}

export const offerPdfTemplateUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PDF_SIZE, files: 1 },
    fileFilter: pdfFilter,
});

export default offerPdfTemplateUpload;
