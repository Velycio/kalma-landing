/**
 * Genera UN artículo nuevo para el blog de Kalma llamando a la API de Claude
 * (con "tool use" → salida estructurada garantizada) y lo guarda en posts/<slug>.json.
 * Luego build-site.mjs lo incorpora.
 *
 * Uso (lo llama el GitHub Action):  ANTHROPIC_API_KEY=... node scripts/generate-post.mjs
 * Sin dependencias externas (usa fetch nativo de Node 18+).
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_DIR = resolve(ROOT, "posts");
mkdirSync(POSTS_DIR, { recursive: true });

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.MODEL || "claude-sonnet-5";
if (!API_KEY) {
  console.error("Falta ANTHROPIC_API_KEY");
  process.exit(1);
}

const SEED = [
  "como-usar-un-contador-de-contracciones",
  "regla-5-1-1-cuando-ir-al-hospital",
  "contar-patadas-del-bebe",
  "que-llevar-bolsa-hospital",
];
const FEATURES = [
  "contador-de-contracciones", "contador-de-patadas", "diario-de-embarazo",
  "bebe-semana-a-semana", "bolsa-del-hospital", "app-embarazo-pareja",
  "citas-medicas", "preguntas-embarazo", "tienda", "respiracion", "bolsa-rota",
];

const existing = new Set(SEED);
if (existsSync(POSTS_DIR)) {
  for (const f of readdirSync(POSTS_DIR).filter((f) => f.endsWith(".json"))) {
    try { existing.add(JSON.parse(readFileSync(resolve(POSTS_DIR, f), "utf8")).slug); } catch {}
  }
}

const slugify = (s) =>
  String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

const SYSTEM = `Eres redactora del blog de Kalma, una app de embarazo en español (España). Voz cálida, cercana y tranquilizadora, sin ser cursi; frases claras y cortas.

REGLAS DE SEGURIDAD (obligatorias, es contenido de salud):
- Kalma y el blog INFORMAN, no diagnostican ni dan consejo médico.
- Nunca tranquilices sobre síntomas concretos: describe y remite SIEMPRE a la matrona/médico o al 112.
- Si el tema roza síntomas o señales de alarma, incluye en el body un bloque <div class="med"><b>Importante:</b> ...</div> remitiendo al profesional.
- No inventes datos, cifras ni estudios concretos. Nada de promesas médicas.

CALIDAD:
- 550-850 palabras. Primer párrafo que engancha. 2-3 <h2>. Incluye la palabra clave principal en el título y en el primer párrafo.
- Enlaza al menos una vez a la función relacionada con <a href="/funciones/SLUG-FEATURE.html">.
- HTML permitido en el body: <p>, <h2>, <h3>, <ul>/<ol>/<li>, <strong>/<b>, <a>, <blockquote class="pull">frase</blockquote>, <div class="med">, <div class="callout">.
- Elige un tema NUEVO y útil, distinto de los ya publicados.

Usa la herramienta "crear_post" para entregar el artículo.`;

const USER = `Escribe un artículo nuevo para embarazadas y sus parejas.
Temas ya publicados (elige un ángulo DISTINTO, no repitas): ${[...existing].join(", ")}.
Funciones válidas para "feature": ${FEATURES.join(", ")}.`;

const tool = {
  name: "crear_post",
  description: "Entrega un artículo de blog listo para publicar en Kalma.",
  input_schema: {
    type: "object",
    properties: {
      slug: { type: "string", description: "kebab-case sin acentos, descriptivo y único" },
      title: { type: "string", description: "Título humano, ≤60 caracteres" },
      metaTitle: { type: "string", description: "Título SEO terminado en ' | Kalma', ≤60 car." },
      metaDesc: { type: "string", description: "Meta description atractiva, ≤155 car." },
      excerpt: { type: "string", description: "Frase gancho para las tarjetas, ≤120 car." },
      tag: { type: "string", description: "Categoría: Contracciones, Parto, Movimientos del bebé, Preparación, Bienestar, Semana a semana o En pareja" },
      feature: { type: "string", description: "Slug de la función relacionada (de la lista dada)" },
      related: { type: "array", items: { type: "string" }, description: "1-2 slugs de artículos existentes" },
      faqs: {
        type: "array",
        items: { type: "object", properties: { q: { type: "string" }, a: { type: "string" } }, required: ["q", "a"] },
        description: "2-3 preguntas frecuentes; la respuesta 'a' en HTML (<p>...</p>)",
      },
      body: { type: "string", description: "Cuerpo del artículo en HTML (550-850 palabras)" },
    },
    required: ["slug", "title", "metaTitle", "metaDesc", "excerpt", "tag", "feature", "body"],
  },
};

const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
  body: JSON.stringify({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM,
    tools: [tool],
    tool_choice: { type: "tool", name: "crear_post" },
    messages: [{ role: "user", content: USER }],
  }),
});
if (!res.ok) {
  console.error("Error de la API:", res.status, await res.text());
  process.exit(1);
}
const data = await res.json();
const block = (data.content || []).find((b) => b.type === "tool_use");
if (!block || !block.input) {
  console.error("La API no devolvió el post esperado:", JSON.stringify(data).slice(0, 500));
  process.exit(1);
}
const post = block.input;

// Validación y saneado
post.slug = slugify(post.slug || post.title);
if (!post.slug || existing.has(post.slug)) post.slug = `${post.slug || "post"}-${Date.now().toString(36)}`;
if (!FEATURES.includes(post.feature)) post.feature = "preguntas-embarazo";
post.related = Array.isArray(post.related) ? post.related.filter((s) => existing.has(s) && s !== post.slug).slice(0, 2) : [];
post.faqs = Array.isArray(post.faqs)
  ? post.faqs.filter((f) => f && f.q && f.a).map((f) => ({ q: String(f.q), a: /^\s*</.test(f.a) ? f.a : `<p>${f.a}</p>` }))
  : [];
for (const k of ["title", "metaTitle", "metaDesc", "excerpt", "body", "tag"]) {
  if (!post[k] || typeof post[k] !== "string") { console.error("Falta o inválido el campo:", k); process.exit(1); }
}

// Fecha y tiempo de lectura los pone el script (no el modelo)
const now = new Date();
post.dateISO = now.toISOString().slice(0, 10);
post.date = now.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
const words = post.body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
post.readMin = Math.max(2, Math.round(words / 200));

const out = resolve(POSTS_DIR, `${post.slug}.json`);
writeFileSync(out, JSON.stringify(post, null, 2) + "\n", "utf8");
console.log("✓ Artículo creado:", `${post.slug}.json`, `(${words} palabras, ${post.readMin} min)`);
