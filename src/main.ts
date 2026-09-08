console.log('Plugin załadowany poprawnie! Hot Reload działa.');

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('action-btn');
    const counterDisplay = document.getElementById('click-counter');

    let counter = 0;

    if (btn && counterDisplay) {
        btn.addEventListener('click', () => {
            counter++;
            counterDisplay.textContent = counter.toString();
        });
    }

    setTimeout(() => {
        (window as any).__ZENSO_READY__ = true;
        console.log('__ZENSO_READY__ set to true');
    }, 500);
});
