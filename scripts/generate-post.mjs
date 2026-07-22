/**
 * Genera UN artículo nuevo para el blog de Kalma llamando a la API de Claude
 * y lo guarda en posts/<slug>.json. Luego build-site.mjs lo incorpora.
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

// Posts semilla (van dentro de build-site.mjs) + funciones válidas
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

// Slugs ya existentes (semilla + posts generados)
const existing = new Set(SEED);
if (existsSync(POSTS_DIR)) {
  for (const f of readdirSync(POSTS_DIR).filter((f) => f.endsWith(".json"))) {
    try { existing.add(JSON.parse(readFileSync(resolve(POSTS_DIR, f), "utf8")).slug); } catch {}
  }
}

const slugify = (s) =>
  String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

const SYSTEM = `Eres redactora del blog de Kalma, una app de embarazo en español. Escribes con voz cálida, cercana y tranquilizadora, sin ser cursi; frases claras y cortas.

REGLAS DE SEGURIDAD (obligatorias, es contenido de salud):
- Kalma y el blog INFORMAN, no diagnostican ni dan consejo médico.
- Nunca tranquilices sobre síntomas concretos: describe y remite SIEMPRE a la matrona/médico o al 112.
- Si el tema roza síntomas o señales de alarma, incluye un bloque <div class="med"><b>Importante:</b> ...</div> remitiendo al profesional.
- No inventes datos, cifras ni estudios concretos. Nada de promesas médicas.

FORMATO DE SALIDA: devuelve EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin \`\`\`), con estas claves:
{
 "slug": "kebab-case sin acentos, único, descriptivo",
 "title": "Título humano (≤60 car.)",
 "metaTitle": "Título SEO terminando en ' | Kalma' (≤60 car.)",
 "metaDesc": "Meta description atractiva (≤155 car.)",
 "excerpt": "Una frase que engancha (≤120 car.)",
 "tag": "Categoría corta: una de [Contracciones, Parto, Movimientos del bebé, Preparación, Bienestar, Semana a semana, En pareja]",
 "feature": "una de las funciones válidas que se te den",
 "related": ["slugs de la lista de existentes, 1-2, sin incluir el propio"],
 "faqs": [{"q":"¿Pregunta?","a":"<p>Respuesta breve.</p>"}],
 "body": "HTML del artículo, 550-850 palabras"
}

HTML permitido en body: <p>, <h2>, <h3>, <ul>/<ol>/<li>, <strong>/<b>, <a href=\\"/funciones/...\\">, <blockquote class=\\"pull\\">frase</blockquote>, <div class=\\"med\\">, <div class=\\"callout\\">. El primer párrafo engancha. Incluye 2-3 <h2>. Enlaza al menos una vez a la función relacionada (/funciones/<feature>.html). Incluye la palabra clave principal en title y primer párrafo. Español de España.`;

const USER = `Escribe UN artículo nuevo y útil para embarazadas y sus parejas.
Temas/artículos que YA existen (elige un ángulo NUEVO y distinto, no repitas): ${[...existing].join(", ")}.
Funciones válidas para "feature": ${FEATURES.join(", ")}.
Devuelve SOLO el JSON.`;

const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
  body: JSON.stringify({ model: MODEL, max_tokens: 3200, system: SYSTEM, messages: [{ role: "user", content: USER }] }),
});
if (!res.ok) {
  console.error("Error de la API:", res.status, await res.text());
  process.exit(1);
}
const data = await res.json();
let text = (data.content || []).map((b) => b.text || "").join("").trim();
text = text.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();

let post;
try { post = JSON.parse(text); } catch (e) {
  console.error("La respuesta no era JSON válido:\n", text.slice(0, 500));
  process.exit(1);
}

// Validación y saneado
post.slug = slugify(post.slug || post.title);
if (!post.slug || existing.has(post.slug)) post.slug = `${post.slug || "post"}-${Date.now().toString(36)}`;
if (!FEATURES.includes(post.feature)) post.feature = "preguntas-embarazo";
const allSlugs = new Set([...existing]);
post.related = Array.isArray(post.related) ? post.related.filter((s) => allSlugs.has(s) && s !== post.slug).slice(0, 2) : [];
if (!Array.isArray(post.faqs)) post.faqs = [];
for (const k of ["title", "metaTitle", "metaDesc", "excerpt", "body", "tag"]) {
  if (!post[k] || typeof post[k] !== "string") { console.error("Falta campo:", k); process.exit(1); }
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
