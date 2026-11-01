(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.classList.add('soh-ready');
    document.body.classList.add('soh-page-reveal');

    const progress = document.createElement('div');
    progress.className = 'soh-scroll-progress';
    document.body.appendChild(progress);

    const updateProgress = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.width = `${max > 0 ? Math.min(100, window.scrollY / max * 100) : 0}%`;
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();

    if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
        const aura = document.createElement('div');
        aura.className = 'soh-cursor-aura';
        document.body.appendChild(aura);
        window.addEventListener('pointermove', (event) => {
            aura.style.left = `${event.clientX}px`;
            aura.style.top = `${event.clientY}px`;
            aura.style.opacity = '1';
        }, { passive: true });
        document.documentElement.addEventListener('mouseleave', () => { aura.style.opacity = '0'; });
    }

    const selector = '.service-card,.product-card,.plan-card,.dashboard-card,.cart-item,.cart-summary,.seller-card,.login-card,.empty-cart,.tracking-stage';
    const cards = document.querySelectorAll(selector);
    cards.forEach((card, index) => {
        card.classList.add('soh-lux-card','soh-reveal');
        card.style.transitionDelay = `${Math.min(index * 55, 330)}ms`;
        if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
            card.addEventListener('pointermove', (event) => {
                const rect = card.getBoundingClientRect();
                const x = (event.clientX - rect.left) / rect.width - .5;
                const y = (event.clientY - rect.top) / rect.height - .5;
                card.style.transform = `perspective(900px) rotateX(${y * -2.2}deg) rotateY(${x * 2.2}deg) translateY(-3px)`;
            });
            card.addEventListener('pointerleave', () => { card.style.transform = ''; });
        }
    });

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: .12, rootMargin: '0px 0px -35px' });
        cards.forEach(card => observer.observe(card));
    } else cards.forEach(card => card.classList.add('is-visible'));

    if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
        document.querySelectorAll('button,.nav-button,.btn,.primary-button,.plan-button,.login-btn,.add-button,.buy-button').forEach((element) => {
            element.classList.add('soh-magnetic');
            element.addEventListener('pointermove', (event) => {
                const rect = element.getBoundingClientRect();
                const x = event.clientX - rect.left - rect.width / 2;
                const y = event.clientY - rect.top - rect.height / 2;
                element.style.transform = `translate(${x * .08}px,${y * .08}px)`;
            });
            element.addEventListener('pointerleave', () => { element.style.transform = ''; });
        });
    }
})();
