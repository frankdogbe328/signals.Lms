// Background Image Handler
// This script helps load the Pinterest background image

document.addEventListener('DOMContentLoaded', function() {
    // Try to load the Pinterest image
    // Note: Pinterest images may require CORS or direct image URL
    // To get the direct image URL:
    // 1. Open the Pinterest pin in a browser
    // 2. Right-click on the image
    // 3. Select "Copy image address" or "Open image in new tab"
    // 4. Use that URL in the CSS
    
    const pinterestImageUrl = 'https://pin.it/3rdoKtyau';
    
    // Create a test image to check if it loads
    const testImage = new Image();
    testImage.onload = function() {
        // Image loaded successfully
        document.body.style.setProperty('--bg-image-loaded', 'true');
    };
    testImage.onerror = function() {
        // If Pinterest URL doesn't work, you can replace it with direct image URL
        console.log('Background image could not be loaded. Please use direct image URL.');
        console.log('To get direct URL: Right-click Pinterest image > Copy image address');
    };
    
    // Try loading the image (this may not work due to CORS)
    // The CSS will handle the fallback gradient
    testImage.src = pinterestImageUrl;
});
