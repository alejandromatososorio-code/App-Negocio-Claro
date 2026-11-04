// Cloudflare Pages Function: responde a POST /api/informe
// Necesita el binding de Workers AI con el nombre AI (se crea en el panel de Cloudflare).
// Prueba varios modelos en orden: si uno está retirado o falla, pasa al siguiente.
const MODELS = [
  '@cf/meta/llama-3.1-8b-instruct-fast',
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/zai-org/glm-4.7-flash',
];
const cut = (s, n) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, n);
const pick = (r) => String(r?.response ?? r?.choices?.[0]?.message?.content ?? '').trim();

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

    const messages = [
      {
        role: 'system',
        content:
          'Eres un consultor de negocios cercano que habla con dueños de pequeños negocios en Cuba. ' +
          'Escribe en español sencillo, sin tecnicismos. Usa SOLO los datos que te dan: no inventes cifras, ' +
          'precios, competidores ni hechos. Máximo 110 palabras. Formato: una frase que resuma cómo está el ' +
          'negocio, y después tres consejos cortos y concretos basados en los problemas principales.',
      },
      { role: 'user', content: datos },
    ];

    let t = '';
    let fallo = '';
    for (const m of MODELS) {
      try {
        t = pick(await env.AI.run(m, { messages, max_tokens: 400 })).slice(0, 1200);
        if (t) break;
      } catch (e) {
        fallo = String(e && e.message ? e.message : e).slice(0, 140);
      }
    }
    if (!t) return Response.json({ error: 'ia', d: fallo || 'sin respuesta' }, { status: 502 });
    return Response.json({ t });
  } catch (e) {
    return Response.json({ error: 'ia', d: String(e && e.message ? e.message : e).slice(0, 140) }, { status: 500 });
  }
}

// Diagnóstico: abre /api/informe en el navegador. Debe mostrar {"ok":true,"ai":true}
export async function onRequestGet({ env }) {
  return Response.json({ ok: true, ai: !!env.AI });
}
