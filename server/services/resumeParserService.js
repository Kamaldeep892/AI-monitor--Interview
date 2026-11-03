import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';

export const extractTextFromBuffer = async (buffer, mimetype) => {
  if (mimetype === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text.replace(/\s+/g, ' ').trim();
  }
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.replace(/\s+/g, ' ').trim();
  }
  throw new Error('Unsupported document format');
};
