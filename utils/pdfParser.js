import { PDFDocument } from 'pdf-lib';

export async function extractTextFromPDF(buffer) {
  try {
    const pdfDoc = await PDFDocument.load(buffer);
    const pages = pdfDoc.getPages();
    let text = '';

    for (const page of pages) {
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ');
    }

    return text;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw error;
  }
} 