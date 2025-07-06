// HTML Export functionality for AI Textbook Editor
// Handles markdown to HTML conversion with styling and embedded images

export async function exportToHTML(content, filename = 'document') {
    if (!content || content.trim() === '') {
        alert('No content to export');
        return;
    }

    // Convert markdown to HTML with embedded images
    const htmlContent = await markdownToHTML(content);
   
    // Create a complete HTML document with styling
    const fullHTML = createStyledHTML(htmlContent, filename);
   
    // Create and download the file
    const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename + '.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Convert markdown to HTML
async function markdownToHTML(markdown) {
    let html = markdown;
   
    // Headers
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
   
    // Horizontal rules (dividers)
    html = html.replace(/^[\s]*\*{3,}[\s]*$/gm, '<hr>');
    html = html.replace(/^[\s]*-{3,}[\s]*$/gm, '<hr>');
    html = html.replace(/^[\s]*_{3,}[\s]*$/gm, '<hr>');
   
    // Bold and Italic
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/___(.*?)___/g, '<strong><em>$1</em></strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');
   
    // Code
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
   
    // Images - Convert to base64 embedded images (PROCESS BEFORE LINKS!)
    const imageMatches = html.match(/!\[([^\]]*)\]\(([^)]+)\)/g);
    if (imageMatches) {
        for (const match of imageMatches) {
            const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/;
            const imageMatch = match.match(imageRegex);
            const altText = imageMatch[1] || 'Image';
            const imageUrl = imageMatch[2];
           
            try {
                const base64Image = await loadImageAsBase64(imageUrl);
                if (base64Image) {
                    const imgTag = `<img src="${base64Image}" alt="${escapeHtml(altText)}" style="max-width: 100%; height: auto; margin: 10px 0; display: block;" />`;
                    html = html.replace(match, imgTag);
                } else {
                    // Fallback: show placeholder
                    const imgTag = `<div style="border: 2px dashed #ccc; padding: 20px; text-align: center; margin: 10px 0; background-color: #f9f9f9;">
                        <p style="margin: 0; color: #666;">📷 Image: ${escapeHtml(altText)}</p>
                        <p style="margin: 5px 0 0; font-size: 0.8em; color: #999;">Original URL: ${escapeHtml(imageUrl)}</p>
                    </div>`;
                    html = html.replace(match, imgTag);
                }
            } catch (error) {
                // Fallback placeholder
                const imgTag = `<div style="border: 2px dashed #ccc; padding: 20px; text-align: center; margin: 10px 0; background-color: #f9f9f9;">
                    <p style="margin: 0; color: #666;">📷 Image: ${escapeHtml(altText)}</p>
                    <p style="margin: 5px 0 0; font-size: 0.8em; color: #999;">Failed to load: ${escapeHtml(imageUrl)}</p>
                </div>`;
                html = html.replace(match, imgTag);
            }
        }
    }
   
    // Links (PROCESS AFTER IMAGES!)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
   
    // Strikethrough
    html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');
   
    // Process line by line for lists and other block elements
    const lines = html.split('\n');
    const processedLines = [];
    let inUnorderedList = false;
    let inOrderedList = false;
    let inCodeBlock = false;
    let inBlockquote = false;
   
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
       
        // Code blocks
        if (line.startsWith('```') || line.startsWith('~~~')) {
            if (!inCodeBlock) {
                const language = line.substring(3).trim();
                processedLines.push(`<pre><code class="language-${language}">`);
                inCodeBlock = true;
            } else {
                processedLines.push('</code></pre>');
                inCodeBlock = false;
            }
            continue;
        }
       
        if (inCodeBlock) {
            processedLines.push(escapeHtml(line));
            continue;
        }
       
        // Blockquotes
        if (line.startsWith('> ')) {
            if (!inBlockquote) {
                processedLines.push('<blockquote>');
                inBlockquote = true;
            }
            processedLines.push('<p>' + line.substring(2) + '</p>');
            continue;
        } else if (inBlockquote) {
            processedLines.push('</blockquote>');
            inBlockquote = false;
        }
       
        // Unordered lists
        if (line.match(/^[\s]*[-*+]\s/)) {
            if (!inUnorderedList) {
                processedLines.push('<ul>');
                inUnorderedList = true;
            }
            const text = line.replace(/^[\s]*[-*+]\s/, '');
            processedLines.push(`<li>${text}</li>`);
            continue;
        } else if (inUnorderedList) {
            processedLines.push('</ul>');
            inUnorderedList = false;
        }
       
        // Ordered lists
        if (line.match(/^[\s]*\d+\.\s/)) {
            if (!inOrderedList) {
                processedLines.push('<ol>');
                inOrderedList = true;
            }
            const text = line.replace(/^[\s]*\d+\.\s/, '');
            processedLines.push(`<li>${text}</li>`);
            continue;
        } else if (inOrderedList) {
            processedLines.push('</ol>');
            inOrderedList = false;
        }
       
        // Empty lines
        if (line.trim() === '') {
            processedLines.push('<br>');
            continue;
        }
       
        // Regular paragraphs
        if (!line.match(/^<[h1-6|ul|ol|li|blockquote|pre|hr]/)) {
            processedLines.push(`<p>${line}</p>`);
        } else {
            processedLines.push(line);
        }
    }
   
    // Close any open lists or blockquotes
    if (inUnorderedList) processedLines.push('</ul>');
    if (inOrderedList) processedLines.push('</ol>');
    if (inBlockquote) processedLines.push('</blockquote>');
    if (inCodeBlock) processedLines.push('</code></pre>');
   
    return processedLines.join('\n');
}

// Create a complete HTML document with styling
function createStyledHTML(content, title) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #fff;
        }
       
        h1, h2, h3, h4, h5, h6 {
            margin-top: 2em;
            margin-bottom: 1em;
            font-weight: 600;
            line-height: 1.25;
        }
       
        h1 {
            font-size: 2em;
            border-bottom: 2px solid #eee;
            padding-bottom: 0.3em;
        }
       
        h2 {
            font-size: 1.5em;
            border-bottom: 1px solid #eee;
            padding-bottom: 0.3em;
        }
       
        h3 {
            font-size: 1.25em;
        }
       
        p {
            margin: 1em 0;
        }
       
        ul, ol {
            margin: 1em 0;
            padding-left: 2em;
        }
       
        li {
            margin: 0.5em 0;
        }
       
        blockquote {
            margin: 1em 0;
            padding: 0 1em;
            color: #666;
            border-left: 4px solid #ddd;
            background-color: #f9f9f9;
        }
       
        code {
            background-color: #f4f4f4;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.9em;
        }
       
        pre {
            background-color: #f4f4f4;
            padding: 1em;
            border-radius: 5px;
            overflow-x: auto;
            margin: 1em 0;
        }
       
        pre code {
            background-color: transparent;
            padding: 0;
        }
       
        a {
            color: #0366d6;
            text-decoration: none;
        }
       
        a:hover {
            text-decoration: underline;
        }
       
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 1em auto;
            border-radius: 5px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
       
        hr {
            border: none;
            border-top: 2px solid #eee;
            margin: 2em 0;
        }
       
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
        }
       
        th, td {
            border: 1px solid #ddd;
            padding: 8px 12px;
            text-align: left;
        }
       
        th {
            background-color: #f5f5f5;
            font-weight: 600;
        }
       
        del {
            color: #999;
        }
       
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
           
            h1 {
                font-size: 1.5em;
            }
           
            h2 {
                font-size: 1.25em;
            }
        }
       
        @media print {
            body {
                max-width: none;
                margin: 0;
            }
           
            a {
                color: #000;
                text-decoration: none;
            }
           
            a:after {
                content: " (" attr(href) ")";
                font-size: 0.8em;
                color: #666;
            }
        }
    </style>
</head>
<body>
${content}
</body>
</html>`;
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper function to load image as base64 (reused from pdfExport.js)
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