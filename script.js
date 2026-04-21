const sr = ScrollReveal({
    distance: '50px',
    duration: 800,
    easing: 'ease-in-out',
    origin: 'bottom',
    reset: false
});

sr.reveal('.reveal');

const sections = document.querySelectorAll('#Solution, #Offre, #Propos, #Contact');
const navLinks = document.querySelectorAll('.nav-links a');



window.addEventListener('scroll', () => {
    let current = '';

    sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= 150) {
            current = section.id;
        }
    });


    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});