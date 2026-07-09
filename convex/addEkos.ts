import { mutation } from "./_generated/server";

export default mutation(async (ctx) => {
  const eventDate = new Date("2026-07-08T09:00:00-05:00").getTime();
  
  await ctx.db.insert("events", {
    title: "Ekos AI Business Summit 2026",
    description: "El mayor encuentro empresarial sobre Inteligencia Artificial en Ecuador. Descubre cómo la IA está transformando la gestión empresarial, la toma de decisiones, la atención al cliente y la eficiencia operativa. Edición: IA vs Humanos.",
    dateStart: eventDate,
    country: "Ecuador",
    city: "Quito",
    isVirtual: false,
    isHybrid: false,
    category: "AI & Data Science",
    isFree: false,
    price: "Consultar valor",
    registrationUrl: "https://ekoseventos.com/iasummit2026-quito",
    status: "PUBLISHED",
    language: "es",
    tags: ["Ekos", "AI", "Business"],
    source: "Grupo Ekos",
    isLinkValid: true,
    imageUrl: "https://ekoseventos.com/wp-content/uploads/2026/01/logo-ia-summit-2026.png"
  });
});
