/* Provisional identity: update here once the final brand is approved. */
const brand = Object.freeze({ name: "Inbox Zero", support: "inboxzero@lakshly.com" });
document.querySelectorAll("[data-brand]").forEach(element => {
  const value = brand[element.dataset.brand];
  if (value) element.textContent = value;
});
document.title = document.title.replace(/Inbox Zero$/, brand.name);
