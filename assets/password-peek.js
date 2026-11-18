// Keep the real value in a native password field. Only the visual overlay
// reveals the most recently typed character; paste/autofill stay masked.
export function passwordPeek(input, preview) {
  let timer;
  const mask = () => {
    clearTimeout(timer);
    input.classList.remove('password-peeking');
    preview.hidden = !input.value;
    preview.firstElementChild.textContent = '•'.repeat(Array.from(input.value).length);
  };
  const align = () => {
    preview.firstElementChild.style.transform = `translateX(${-input.scrollLeft}px)`;
  };
  input.addEventListener('input', event => {
    mask();
    if (event.inputType !== 'insertText' || !event.data || event.isComposing) return;
    const end = input.selectionStart;
    if (!end) return;
    const before = Array.from(input.value.slice(0, end));
    const last = before.pop();
    preview.firstElementChild.textContent = '•'.repeat(before.length) + last + '•'.repeat(Array.from(input.value.slice(end)).length);
    preview.hidden = false;
    input.classList.add('password-peeking');
    align();
    timer = setTimeout(mask, 1000);
  });
  input.addEventListener('scroll', align);
  input.addEventListener('blur', mask);
  input.addEventListener('change', mask);
  input.form?.addEventListener('submit', mask);
  input.classList.add('password-peek-ready');
  mask();
  return mask;
}
