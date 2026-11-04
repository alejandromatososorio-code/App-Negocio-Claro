// Cloudflare Pages Function: responde a POST /api/informe
// Necesita el binding de Workers AI con el nombre AI (se crea en el panel de Cloudflare).
const MODEL = '@cf/meta/llama-3.1-8b-instruct';
const cut = (s, n) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, n);

export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json();
    const dn = Number(b.dn);
    const mn = Number(b.mn);
    const hm = Number(b.hm) || 0;
    if (!(dn >= 0 && dn <= 100)) return Response.json({ error: 'datos' }, { status: 400 });

    const problemas = (Array.isArray(b.p) ? b.p : []).slice(0, 3).map((x) => cut(x, 120));
    const datos =
      `Negocio: ${cut(b.n, 40) || 'sin nombre'}. ` +
      `Nota digital: ${Math.round(dn)} de 100. ` +
      `Madurez: ${Number.isFinite(mn) ? mn.toFixed(1) : 'sin datos'} de 5. ` +
      `Horas al mes en tareas manuales: ${Math.round(hm)}. ` +
      `Problemas principales: ${problemas.join('; ') || 'ninguno grave'}.`;

    const r = await env.AI.run(MODEL, {
      messages: [
        {
          role: 'system',
          content:
            'Eres un consultor de negocios cercano que habla con dueños de pequeños negocios en Cuba. ' +
            'Escribe en español sencillo, sin tecnicismos. Usa SOLO los datos que te dan: no inventes cifras, ' +
            'precios, competidores ni hechos. Máximo 110 palabras. Formato: una frase que resuma cómo está el ' +
            'negocio, y después tres consejos cortos y concretos basados en los problemas principales.',
        },
        { role: 'user', content: datos },
      ],
      max_tokens: 320,
    });

    const t = String(r.response || '').trim().slice(0, 1200);
    if (!t) return Response.json({ error: 'vacio' }, { status: 502 });
    return Response.json({ t });
  } catch (e) {
    return Response.json({ error: 'ia' }, { status: 500 });
  }
}
