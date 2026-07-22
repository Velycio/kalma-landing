# Cómo publicar un post en el blog de Kalma

Web: https://kalmaapp.pro · Repo: `Velycio/kalma-landing` (GitHub Pages).
El sitio es **estático y generado**. No se edita el HTML a mano: se editan los **datos** y se regenera.

## Pasos para publicar un artículo

1. **Añade el post** al array `POSTS` en [`scripts/build-site.mjs`](scripts/build-site.mjs). Copia un post existente como plantilla y rellena los campos (ver esquema abajo).
2. *(Opcional pero recomendado)* **Foto de portada**: guarda una imagen en `assets/blog/<slug>.jpg` (horizontal, ~1200px, libre para uso comercial sin atribución — Pexels/Unsplash) y añádela a los mapas `POST_COVER` y `POST_TAG` (por `slug`).
3. **Genera el sitio**:
   ```bash
   node scripts/build-site.mjs
   ```
   Esto reconstruye el artículo, la portada del blog, `sitemap.xml` y `llms.txt`.
4. **Publica**:
   ```bash
   git add -A && git commit -m "blog: <título del post>" && git push
   ```
   GitHub Pages lo despliega solo en ~1-2 min. Verifica en `https://kalmaapp.pro/blog/<slug>.html`.

## Esquema de un post (objeto dentro de `POSTS`)

```js
{
  slug: "como-preparar-el-plan-de-parto",   // URL: /blog/<slug>.html (minúsculas, sin acentos, guiones)
  title: "Cómo preparar tu plan de parto",  // título visible
  metaTitle: "Cómo preparar tu plan de parto — Guía | Kalma", // <title> SEO (≈60 car.)
  metaDesc: "Qué es un plan de parto, qué incluir y cómo hablarlo con tu matrona.", // meta description (≈150 car.)
  date: "22 de julio de 2026",   // fecha visible
  dateISO: "2026-07-22",          // fecha ISO (para schema/sitemap)
  readMin: 4,                     // minutos de lectura
  excerpt: "Una frase que engancha y resume el artículo.", // se ve en las tarjetas
  body: `
<p>Primer párrafo (sale más grande, con letra capital).</p>
<h2>Un subtítulo</h2>
<p>Texto...</p>
<blockquote class="pull">Frase destacada.</blockquote>
<ul><li>Punto</li></ul>
<div class="med"><b>Importante:</b> aviso clínico si aplica.</div>
`,
  faqs: [ { q: "¿Pregunta?", a: "<p>Respuesta.</p>" } ], // opcional, genera FAQ + schema
  related: ["regla-5-1-1-cuando-ir-al-hospital"],        // slugs de otros posts
  feature: "contador-de-contracciones",                   // función relacionada (para el enlace y el icono)
}
```

Y en los mapas de arriba del archivo:
```js
const POST_TAG   = { "<slug>": "Parto" };          // categoría (chip)
const POST_COVER = { "<slug>": "mi-portada.jpg" };  // archivo en assets/blog/
```

## Estilo y reglas (IMPORTANTES)

- **Voz Kalma**: cálida, cercana, tranquilizadora sin ser cursi. Frases claras.
- **Seguridad clínica**: la app y el blog **informan, no diagnostican**. Nunca dar consejo médico ni tranquilizar sobre síntomas: **describir y remitir a la matrona/hospital**. Usa el bloque `<div class="med">` para avisos.
- **SEO**: incluye la palabra clave principal en `title`, `metaTitle`, primer párrafo y algún `<h2>`. Enlaza a la función relacionada (`/funciones/...`) dentro del `body`.
- **Sin emojis** como iconos. HTML permitido en `body`: `p, h2, h3, ul/ol/li, strong/b, a, blockquote.pull, div.med, div.callout`.
- **Longitud**: 500-900 palabras va bien para SEO.

## Requisitos del entorno
- Node.js instalado.
- Permiso de push al repo `Velycio/kalma-landing` (token de GitHub o `gh` autenticado).
