/**
 * PDF Generator Module
 * Handles PDF generation using html2pdf.js
 */

const PDFGenerator = (function() {
    /**
     * Wait for fonts to be fully loaded
     */
    async function waitForFonts() {
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
        // Additional delay to ensure fonts are rendered
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    /**
     * Wait for all images to load
     */
    async function waitForImages(container) {
        const images = container.querySelectorAll('img');
        const promises = Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = resolve; // Don't fail on broken images
            });
        });
        await Promise.all(promises);
    }
    
    /**
     * Get positions of elements that should not be split across pages
     */
    function getNoBreakElements(previewElement, scale) {
        const selectors = 'table, pre, h1, h2, h3, h4, h5, h6, blockquote, .mermaid, .katex-display';
        const elements = previewElement.querySelectorAll(selectors);
        return Array.from(elements).map(el => ({
            top: el.offsetTop * scale,
            bottom: (el.offsetTop + el.offsetHeight) * scale,
            height: el.offsetHeight * scale,
            tag: el.tagName.toLowerCase()
        }));
    }
    
    /**
     * Find safe page break position that doesn't cut elements
     */
    function findSafePageBreak(idealBreakY, noBreakElements, minPageHeight) {
        // Check if ideal break point would cut any element
        for (const el of noBreakElements) {
            // If break would occur inside this element
            if (idealBreakY > el.top && idealBreakY < el.bottom) {
                // Move break to before this element (with small margin)
                const safeBreak = el.top - 10; // 10px margin before element
                // Only adjust if it doesn't make page too short (at least 30% of ideal)
                if (safeBreak > minPageHeight) {
                    return { adjusted: true, breakY: safeBreak, reason: el.tag };
                }
            }
        }
        return { adjusted: false, breakY: idealBreakY, reason: null };
    }
    
    /**
     * Generate PDF from the preview element
     */
    async function generate(previewElement, filename = 'document.pdf') {
        // Show loading indicator
        const loading = document.getElementById('loading');
        if (loading) loading.classList.remove('hidden');
        
        try {
            // Wait for fonts and images
            await waitForFonts();
            await waitForImages(previewElement);
            
            // Small delay to ensure mermaid diagrams are rendered
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const scale = 2;
            const noBreakElements = getNoBreakElements(previewElement, scale);
            
            // Render preview to canvas
            const canvas = await html2canvas(previewElement, {
                scale: scale,
                useCORS: true,
                logging: false,
                scrollX: 0,
                scrollY: 0,
                windowWidth: previewElement.scrollWidth,
                windowHeight: previewElement.scrollHeight
            });
            
            // Convert canvas to PDF using jsPDF directly
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = 0; // Preview already has 10mm padding
            const contentWidth = pdfWidth - (margin * 2);
            const contentHeight = pdfHeight - (margin * 2);
            
            // Scale to fit page width
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = contentWidth / imgWidth;
            const minPageHeightPx = imgHeight * 0.3; // Minimum 30% of ideal page height
            
            // Handle multi-page with smart page breaks
            let currentY = 0; // Current position in canvas pixels
            let pageNum = 1;
            const idealPageHeight = contentHeight / ratio; // Ideal page height in canvas pixels
            
            while (currentY < imgHeight) {
                // Calculate ideal break point
                const idealBreakY = currentY + idealPageHeight;
                
                // Find safe break point that doesn't cut elements
                const safeBreak = findSafePageBreak(idealBreakY, noBreakElements, currentY + minPageHeightPx);
                const actualBreakY = Math.min(safeBreak.breakY, imgHeight);
                const pageHeight = actualBreakY - currentY;
                
                // Create a temporary canvas for this page's portion
                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = imgWidth;
                pageCanvas.height = pageHeight;
                const ctx = pageCanvas.getContext('2d');
                ctx.drawImage(canvas, 0, currentY, imgWidth, pageHeight, 0, 0, imgWidth, pageHeight);
                
                const pageImgData = pageCanvas.toDataURL('image/png');
                const pageHeightMM = pageHeight * ratio;
                pdf.addImage(pageImgData, 'PNG', margin, margin, contentWidth, pageHeightMM);
                
                currentY = actualBreakY;
                
                if (currentY < imgHeight) {
                    pdf.addPage();
                    pageNum++;
                }
            }
            
            pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
            
            return true;
        } catch (error) {
            console.error('PDF generation error:', error);
            throw error;
        } finally {
            // Hide loading indicator
            if (loading) loading.classList.add('hidden');
        }
    }
    
    // Public API
    return {
        generate
    };
})();
