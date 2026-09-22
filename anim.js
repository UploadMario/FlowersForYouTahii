const TEXTOS = Object.freeze({
    entrada: "Hola, hola de nuevo Tahii ^^",
    finalPrincipal: "Parece que sí te gustó la sorpresita de sistemas jajaja",
    finalSecundario: "Qué hoy tengas un día increíble Tahii ^^"
});
const MESSAGE_TIMING = Object.freeze({ secondaryDelay: 1.8 });

const FLOWER_TIMELINE = Object.freeze({
    intro: 1,
    flowers: [
        { start: 0.5, grow: 2.5, open: 1.5, bloom: 1.5 },
        { start: 3, grow: 2.5, open: 4, bloom: 2 },
        { start: 4, grow: 2, open: 4.7, bloom: 1.3 },
        { start: 9, grow: 3, open: 10.5, bloom: 2 },
        { start: 10, grow: 3, open: 11, bloom: 2 },
        { start: 13, grow: 3, open: 14.5, bloom: 3.5 },
        { start: 14, grow: 3, open: 15.5, bloom: 3.5 },
        
        { start: 14.7, grow: 2.3, open: 16, bloom: 3 }
    ],
    vegetation: 6,
    particles: 8,
    atmosphere: 17,
    crossfade: 17.5,
    end: 19
});

window.flowerAnimation = (() => {
    const scene = document.querySelector('.flowers');
    const flowers = [...scene.querySelectorAll('.sunflower')];
    const foliage = [...scene.children].filter(el => !el.classList.contains('sunflower'));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const primary = document.querySelector('#final-primary');
    const secondary = document.querySelector('#final-secondary');
    document.querySelector('#entry-message').textContent = TEXTOS.entrada;
    primary.textContent = TEXTOS.finalPrincipal;
    secondary.textContent = TEXTOS.finalSecundario;
    let started = false;
    let ambientReleased = false;
    let animations = [];
    let frame;

    document.body.style.setProperty('--intro-duration', `${FLOWER_TIMELINE.intro}s`);
    document.body.style.setProperty('--ambient-delay', `${FLOWER_TIMELINE.end}s`);
    document.body.style.setProperty('--particle-delay', `${FLOWER_TIMELINE.particles}s`);
    document.body.style.setProperty('--atmosphere-delay', `${FLOWER_TIMELINE.atmosphere}s`);
    flowers.forEach((flower, i) => {
        const timing = FLOWER_TIMELINE.flowers[i];
        flower.style.setProperty('--delay', `${timing.start}s`);
        flower.style.setProperty('--grow-duration', `${timing.grow}s`);
        flower.style.setProperty('--open-delay', `${timing.open}s`);
        flower.style.setProperty('--bloom-duration', `${timing.bloom}s`);
        flower.style.setProperty('--leaf-delay', `${Math.max(FLOWER_TIMELINE.vegetation, timing.start + 1)}s`);
    });

    foliage.forEach(root => {
        [root, ...root.querySelectorAll('*')].forEach(el => {
            const style = getComputedStyle(el);
            if (style.animationName === 'none') return;
            const oldDelay = parseFloat(style.animationDelay) || 0;
            const finite = style.animationIterationCount !== 'infinite';
            el.style.setProperty('animation-delay', `${FLOWER_TIMELINE.vegetation + Math.min(oldDelay, 6) * .25}s`, 'important');
            if (finite) el.style.setProperty('animation-duration', '1.5s', 'important');
        });
    });
    function captureAnimations() {
        animations = scene.getAnimations({ subtree: true });
        animations.forEach(animation => animation.pause());
    }
    function start(clock) {
        if (started) return;
        started = true;
        document.body.classList.remove('container');
        document.body.classList.add('experience-started');
        captureAnimations();
        function tick() {
            const seconds = clock();
            flowers.forEach((flower, i) => {
                flower.classList.toggle('is-visible', seconds >= FLOWER_TIMELINE.flowers[i].start);
            });
            foliage.forEach(el => el.classList.toggle('is-visible', seconds >= FLOWER_TIMELINE.vegetation));
            document.body.classList.toggle('is-atmospheric', seconds >= FLOWER_TIMELINE.atmosphere);
            document.body.classList.toggle('is-complete', seconds >= FLOWER_TIMELINE.end);
            [primary, secondary].forEach((message, index) => {
                const visible = seconds >= FLOWER_TIMELINE.end + index * MESSAGE_TIMING.secondaryDelay;
                message.classList.toggle('is-visible', visible);
                message.setAttribute('aria-hidden', String(!visible));
            });
            if (!ambientReleased) animations.forEach(animation => { animation.currentTime = seconds * 1000; });
            if (!ambientReleased && seconds >= FLOWER_TIMELINE.end) {
                ambientReleased = true;
               
                animations.forEach(animation => {
                    
                    if (animation.effect.getTiming().iterations === Infinity) animation.play();
                });
            }
            if (seconds < FLOWER_TIMELINE.end + MESSAGE_TIMING.secondaryDelay) {
                frame = requestAnimationFrame(tick);
            }
        }
        tick();
        reduced.addEventListener('change', () => {
            if (clock() < FLOWER_TIMELINE.end) {
                cancelAnimationFrame(frame);
                captureAnimations();
                tick();
            }
        });
    }
    return { start };
})();
