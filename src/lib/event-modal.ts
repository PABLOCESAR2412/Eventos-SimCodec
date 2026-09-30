import { localeForPath, translator } from "./i18n";
export function initEventModal() {
  const modal = document.querySelector<HTMLDialogElement>("#event-modal");
  const content = document.getElementById("modal-content");
  const close = document.getElementById("close-modal");
  if (!modal || !content || !close) return;
  const t = translator(localeForPath(location.pathname));
  let opener: HTMLElement | null = null,
    previousOverflow = "";
  const setText = (id: string, text: string) => {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  };
  const open = (button: HTMLElement) => {
    if (modal.open) return;
    const data = button.dataset;
    for (const [key, id] of [
      ["title", "modal-title"],
      ["desc", "modal-desc"],
      ["city", "modal-city"],
      ["date", "modal-date"],
      ["price", "modal-price"],
    ])
      setText(id, data[key] ?? "");
    const course = data.kind === "COURSE";
    setText(
      "modal-instructions-title",
      t(course ? "Pasos para el curso" : "Pasos para participar"),
    );
    setText(
      "modal-btn-text",
      t(course ? "Ir a la plataforma" : "Ir al sitio oficial"),
    );
    const instructions = [
      t("Abre el sitio oficial del organizador."),
      t("Revisa requisitos, precio y condiciones de acceso."),
      t(
        course
          ? "Inicia sesión en la plataforma para inscribirte."
          : "Completa la inscripción y guarda la fecha y ubicación.",
      ),
    ];
    document.getElementById("modal-instructions-list")?.replaceChildren(
      ...instructions.map((text) => {
        const item = document.createElement("li");
        item.textContent = text;
        return item;
      }),
    );
    const price = document.getElementById("modal-price");
    if (price)
      price.className =
        "text-xs font-semibold uppercase px-2.5 py-1 rounded-md " +
        (data.priceStatus === "FREE"
          ? "text-emerald-700 dark:text-emerald-400 bg-emerald-400/10"
          : "text-blue-700 dark:text-blue-300 bg-blue-400/10");
    const image = document.querySelector<HTMLImageElement>("#modal-img");
    const imageContainer = document.getElementById("modal-image-container");
    if (imageContainer) imageContainer.hidden = !data.image;
    document
      .getElementById("modal-details")
      ?.toggleAttribute("data-without-image", !data.image);
    if (image && data.image) {
      image.src = data.image;
      image.alt = data.title ?? "";
    }
    const link = document.querySelector<HTMLAnchorElement>("#modal-link");
    if (link) link.href = data.url ?? "#";
    opener = button;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modal.showModal();
    content.scrollTop = 0;
    close.focus({ preventScroll: true });
  };
  const dismiss = () => {
    if (modal.open) modal.close();
  };
  modal.addEventListener("cancel", (event) => {
    event.preventDefault();
    dismiss();
  });
  modal.addEventListener("close", () => {
    document.body.style.overflow = previousOverflow;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  });
  modal.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = [
      ...modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex="0"]',
      ),
    ].filter((element) => element.getClientRects().length > 0);
    const first = controls[0],
      last = controls.at(-1);
    if (
      first &&
      last &&
      (event.shiftKey
        ? document.activeElement === first
        : document.activeElement === last)
    ) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  });
  document
    .querySelectorAll<HTMLElement>(".open-modal-btn")
    .forEach((button) => button.addEventListener("click", () => open(button)));
  document.getElementById("modal-backdrop")?.addEventListener("click", dismiss);
  close.addEventListener("click", dismiss);
}
