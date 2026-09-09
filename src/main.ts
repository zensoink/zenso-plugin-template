const SVG_NS = 'http://www.w3.org/2000/svg';
const CENTER = 60;

function renderTicks(container: SVGGElement): void {
    for (let i = 0; i < 12; i++) {
        const major = i % 3 === 0;
        const outer = 56;
        const inner = major ? 46 : 51;
        const angle = (i * Math.PI) / 6;
        const tick = document.createElementNS(SVG_NS, 'line');
        tick.setAttribute('x1', String(CENTER + inner * Math.sin(angle)));
        tick.setAttribute('y1', String(CENTER - inner * Math.cos(angle)));
        tick.setAttribute('x2', String(CENTER + outer * Math.sin(angle)));
        tick.setAttribute('y2', String(CENTER - outer * Math.cos(angle)));
        tick.setAttribute('class', major ? 'clock-tick major' : 'clock-tick');
        container.appendChild(tick);
    }
}

function setHand(id: string, degrees: number): void {
    const hand = document.getElementById(id);
    if (hand) hand.setAttribute('transform', `rotate(${degrees} ${CENTER} ${CENTER})`);
}

document.addEventListener('DOMContentLoaded', () => {
    const timeEl = document.getElementById('device-time');
    let date = new Date();

    if (timeEl instanceof HTMLTimeElement) {
        const timestamp = Number(timeEl.dataset.timestamp);
        const locale = timeEl.dataset.locale || undefined;
        const timeZone = timeEl.dataset.timeZone || undefined;

        if (Number.isFinite(timestamp)) {
            date = new Date(timestamp * 1000);
        }
        timeEl.dateTime = date.toISOString();
        timeEl.textContent = date.toLocaleString(locale, {
            timeZone,
            dateStyle: 'full',
            timeStyle: 'short'
        });
    }

    const ticks = document.getElementById('clock-ticks');
    if (ticks instanceof SVGGElement) renderTicks(ticks);

    const seconds = date.getSeconds() + date.getMilliseconds() / 1000;
    const minutes = date.getMinutes() + seconds / 60;
    const hours = (date.getHours() % 12) + minutes / 60;
    setHand('second-hand', seconds * 6);
    setHand('minute-hand', minutes * 6);
    setHand('hour-hand', hours * 30);

    (window as any).__ZENSO_READY__ = true;
});
