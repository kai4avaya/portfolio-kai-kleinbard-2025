// PDF Export functionality for AI Textbook Editor
// Handles markdown to PDF conversion with image support
// Requires jsPDF (add CDN to index.html if not present)

/**
 * Export markdown content to PDF (basic formatting, images supported)
 * @param {string} content - Markdown content
 * @param {string} filename - File name (without extension)
 */
export async function exportToPDF(content, filename = 'document') {
    if (!content || content.trim() === '') {
        alert('No content to export');
        return;
    }

    const doc = new window.jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margins = { top: 20, left: 20, right: 20, bottom: 20 };
    const maxWidth = pageWidth - margins.left - margins.right;
    let y = margins.top;
    const lineHeight = 6;

    // Split content into lines and process markdown
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check if we need a new page
        if (y > pageHeight - margins.bottom - 20) {
            doc.addPage();
            y = margins.top;
        }
        // Handle different markdown elements
        if (line.startsWith('# ')) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            let text = line.substring(2);
            text = text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
            const wrappedText = doc.splitTextToSize(text, maxWidth);
            doc.text(wrappedText, margins.left, y);
            y += wrappedText.length * lineHeight * 1.5;
        } else if (line.startsWith('## ')) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            let text = line.substring(3);
            text = text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
            const wrappedText = doc.splitTextToSize(text, maxWidth);
            doc.text(wrappedText, margins.left, y);
            y += wrappedText.length * lineHeight * 1.3;
        } else if (line.startsWith('### ')) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            let text = line.substring(4);
            text = text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
            const wrappedText = doc.splitTextToSize(text, maxWidth);
            doc.text(wrappedText, margins.left, y);
            y += wrappedText.length * lineHeight * 1.2;
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            const text = '• ' + line.substring(2);
            const wrappedText = doc.splitTextToSize(text, maxWidth - 10);
            doc.text(wrappedText, margins.left + 10, y);
            y += wrappedText.length * lineHeight;
        } else if (line.match(/^\d+\. /)) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            const wrappedText = doc.splitTextToSize(line, maxWidth - 10);
            doc.text(wrappedText, margins.left + 10, y);
            y += wrappedText.length * lineHeight;
        } else if (line.startsWith('> ')) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setFont(undefined, 'italic');
            const text = line.substring(2);
            const wrappedText = doc.splitTextToSize(text, maxWidth - 20);
            doc.text(wrappedText, margins.left + 20, y);
            y += wrappedText.length * lineHeight;
        } else if (line.startsWith('```') || line.startsWith('~~~')) {
            y += lineHeight * 0.5;
        } else if (line.trim() === '') {
            y += lineHeight;
        } else if (line.match(/!\[([^\]]*)\]\(([^)]+)\)/)) {
            // Image handling: ![alt text](url)
            const imageMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
            const altText = imageMatch[1] || 'Image';
            const imageUrl = imageMatch[2];
            try {
                const imageData = await loadImageAsBase64(imageUrl);
                if (imageData) {
                    const imageHeight = 60;
                    if (y + imageHeight > pageHeight - margins.bottom) {
                        doc.addPage();
                        y = margins.top;
                    }
                    const imageWidth = Math.min(maxWidth, 100);
                    doc.addImage(imageData, 'JPEG', margins.left, y, imageWidth, imageHeight);
                    y += imageHeight + 10;
                    if (altText) {
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(8);
                        doc.setFont(undefined, 'italic');
                        doc.text(`Figure: ${altText}`, margins.left, y);
                        y += lineHeight;
                    }
                } else {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(10);
                    doc.setFont(undefined, 'normal');
                    doc.text(`[Image: ${altText}]`, margins.left, y);
                    y += lineHeight;
                }
            } catch (error) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setFont(undefined, 'normal');
                doc.text(`[Image: ${altText}]`, margins.left, y);
                y += lineHeight;
            }
        } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            let processedLine = line;
            processedLine = processedLine.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
            processedLine = processedLine.replace(/\*\*([^*]+)\*\*/g, '$1');
            processedLine = processedLine.replace(/\*([^*]+)\*/g, '$1');
            processedLine = processedLine.replace(/__([^_]+)__/g, '$1');
            processedLine = processedLine.replace(/_([^_]+)_/g, '$1');
            processedLine = processedLine.replace(/`([^`]+)`/g, '$1');
            if (processedLine.trim()) {
                // Remove emojis that can't render in PDF
                processedLine = processedLine.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
                const wrappedText = doc.splitTextToSize(processedLine, maxWidth);
                doc.text(wrappedText, margins.left, y);
                y += wrappedText.length * lineHeight;
            }
        }
        y += 2;
    }
    doc.save(filename + '.pdf');
}

// Helper function to load image as base64
async function loadImageAsBase64(imageUrl) {
    return new Promise((resolve) => {
        if (imageUrl.startsWith('data:')) {
            resolve(imageUrl);
            return;
        }
        // Try to load external image via canvas (CORS permitting)
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                const dataURL = canvas.toDataURL('image/jpeg', 0.8);
                resolve(dataURL);
            } catch (error) {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = imageUrl;
        setTimeout(() => resolve(null), 5000);
    });
} 