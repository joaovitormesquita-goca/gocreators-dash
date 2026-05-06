/**
 * Apice — Sincronizar Pautas (Docs → Gocreators Supabase)
 *
 * Substitui o File 3 antigo (Docs → "Apice - Pautas" sheet).
 * Agora envia direto para a Edge Function ingest-briefing.
 *
 * Configuração obrigatória (Project Settings > Script properties):
 *   BRAND_ID       — id numérico da brand (ex: 7)
 *   INGEST_URL     — https://<project>.supabase.co/functions/v1/ingest-briefing
 *   INGEST_SECRET  — mesmo valor de INGEST_BRIEFING_SECRET na Edge Function
 *
 * Uso: menu "Gocreators > Sincronizar Pautas" no Docs.
 */

function onOpen() {
  DocumentApp.getUi()
    .createMenu('Gocreators')
    .addItem('Sincronizar Pautas', 'syncBriefingsToGocreators')
    .addToUi();
}

function syncBriefingsToGocreators() {
  const props = PropertiesService.getScriptProperties();
  const brandId = parseInt(props.getProperty('BRAND_ID'), 10);
  const ingestUrl = props.getProperty('INGEST_URL');
  const ingestSecret = props.getProperty('INGEST_SECRET');

  if (!brandId || !ingestUrl || !ingestSecret) {
    DocumentApp.getUi().alert(
      'Configuração faltando: BRAND_ID, INGEST_URL ou INGEST_SECRET nos Script Properties.'
    );
    return;
  }

  const docId = DocumentApp.getActiveDocument().getId();
  const briefings = extractBriefingsFromDoc_(docId);

  if (briefings.length === 0) {
    DocumentApp.getUi().alert('Nenhuma pauta encontrada no Docs.');
    return;
  }

  const response = UrlFetchApp.fetch(ingestUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-ingest-secret': ingestSecret },
    payload: JSON.stringify({
      brand_id: brandId,
      source_doc_id: docId,
      briefings: briefings,
    }),
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  let body;
  try {
    body = JSON.parse(response.getContentText() || '{}');
  } catch (e) {
    body = { error: response.getContentText() };
  }

  if (status !== 200) {
    DocumentApp.getUi().alert(
      'Falha (' + status + '): ' + (body.error || response.getContentText())
    );
    return;
  }

  let msg =
    'Sincronização concluída.\n\n' +
    'Recebidas: ' + body.received + '\n' +
    'Novas: ' + body.inserted + '\n' +
    'Atualizadas: ' + body.updated + '\n' +
    'Erros: ' + (body.errors ? body.errors.length : 0);

  if (body.errors && body.errors.length > 0) {
    msg += '\n\nDetalhes dos erros:\n';
    body.errors.slice(0, 10).forEach(function (e) {
      msg += '  • Pauta ' + (e.briefing_number || '?') + ': ' + e.reason + '\n';
    });
  }

  DocumentApp.getUi().alert(msg);
}

/**
 * Parse pautas from the Google Docs and return an array of briefing objects.
 *
 * GAP: This function currently returns an empty array. The user must paste
 * the full parsing logic from their existing File 3 (the message in the
 * brainstorming session was truncated at `const DOC_ID = '1bQ8rABZWcyvTKix...`).
 *
 * Each returned object should match this shape:
 *   {
 *     briefing_number: number,        // required
 *     semana: number | null,
 *     mes: number | null,             // 1-12
 *     ano: number | null,
 *     ref_url: string | null,
 *     take_inicial: string | null,
 *     fala_inicial: string | null,
 *     conceito: string | null,
 *     produtos: string[]              // [] if none
 *   }
 */
function extractBriefingsFromDoc_(docId) {
  // TODO: Paste File 3 parsing logic here. The existing logic iterates over
  // "PAUTA N" sections, extracts Take inicial / Fala inicial / Conceito /
  // Referências / Produtos, and parses Semana, Mês, Ano from "Nomeie o video
  // com..." text. Return an array shaped as described above.
  return [];
}
