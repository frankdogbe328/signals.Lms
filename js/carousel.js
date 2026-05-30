document.addEventListener('DOMContentLoaded', function() {
    const carouselContainer = document.getElementById('background-carousel');
    if (!carouselContainer) return;

    // Get the base path for images from a data attribute, default to current directory
    // If we are in /student/login.html, path should be ../
    // If we are in /index.html, path should be ./
    const basePath = carouselContainer.getAttribute('data-img-path') || './';
    
    // Images: 1.jpeg through 6.jpeg
    const images = [
        '1.jpeg', '2.jpeg', '3.jpeg', '4.jpeg', '5.jpeg', '6.jpeg'
    ];

    // Preload images to avoid flickering
    images.forEach(imgName => {
        const img = new Image();
        img.src = basePath + imgName;
    });

    let currentIndex = 0;
    
    // Initialize carousel
    function initCarousel() {
        // Create image elements
        images.forEach((imgName, index) => {
            const img = document.createElement('div');
            img.classList.add('carousel-slide');
            if (index === 0) img.classList.add('active');
            
            img.style.backgroundImage = `url('${basePath}${imgName}')`;
            carouselContainer.appendChild(img);
        });

        // Start intervals
        setInterval(nextSlide, 5000); // Change every 5 seconds
    }

    function nextSlide() {
        const slides = document.querySelectorAll('.carousel-slide');
        if (slides.length === 0) return;

        // Remove active class from current
        slides[currentIndex].classList.remove('active');

        // Calculate next index
        currentIndex = (currentIndex + 1) % slides.length;

        // Add active class to next
        slides[currentIndex].classList.add('active');
    }

    initCarousel();
});
