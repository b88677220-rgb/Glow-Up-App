(function (root) {
  'use strict';

  const DEFAULT_TIMEOUT_MS = 30000;
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const hasUsage = usage => isRecord(usage) && ['input_tokens', 'output_tokens'].some(key => typeof usage[key] === 'number' && Number.isFinite(usage[key]));
  const usageWarningText = 'Der KI-Verbrauch konnte lokal nicht aktualisiert werden.';

  function typedError(code, status, message) {
    const error = new Error(message);
    error.name = 'GlowUpAIError';
    error.code = code;
    error.status = status;
    error.usageWarning = null;
    return error;
  }

  async function request({ endpoint, action, payload, fetchImpl = root.fetch, onUsage, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    const base = String(endpoint || '').trim().replace(/\/+$/, '');
    if (!base) throw typedError('AI_PROVIDER_UNAVAILABLE', 0, 'KI-Server-URL fehlt.');
    if (typeof fetchImpl !== 'function') throw typedError('AI_PROVIDER_UNAVAILABLE', 0, 'Diese App kann keine KI-Verbindung öffnen.');

    const controller = new AbortController();
    const timeout = Number(timeoutMs);
    const duration = Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), duration);
    let response = null;
    let body = null;
    let parseError = null;
    try {
      response = await fetchImpl(`${base}/api/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
        signal: controller.signal
      });
      try { body = await response.json(); }
      catch (error) { parseError = error; }
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError') {
        throw typedError('AI_TIMEOUT', 504, 'Die KI-Anfrage hat zu lange gedauert. Bitte erneut versuchen.');
      }
      throw typedError('AI_PROVIDER_UNAVAILABLE', 0, 'Der KI-Dienst ist gerade nicht erreichbar. Bitte Verbindung prüfen.');
    } finally {
      clearTimeout(timer);
    }
    if (controller.signal.aborted) throw typedError('AI_TIMEOUT', 504, 'Die KI-Anfrage hat zu lange gedauert. Bitte erneut versuchen.');

    let usageWarning = null;
    if (hasUsage(body?.usage) && typeof onUsage === 'function') {
      try { await onUsage(body.usage); }
      catch { usageWarning = usageWarningText; }
    }

    if (!response.ok) {
      const fallbackCode = response.status === 429 ? 'REQUEST_LIMIT_REACHED' : 'AI_PROVIDER_UNAVAILABLE';
      const error = typedError(
        isRecord(body) && typeof body.code === 'string' ? body.code : fallbackCode,
        response.status,
        isRecord(body) && typeof body.error === 'string' ? body.error : 'Die KI-Anfrage ist fehlgeschlagen. Bitte später erneut versuchen.'
      );
      error.usageWarning = usageWarning;
      throw error;
    }
    if (parseError) {
      const error = typedError('AI_INVALID_JSON', 502, 'Der KI-Dienst hat keine gültige JSON-Antwort geliefert. Bitte erneut versuchen.');
      error.usageWarning = usageWarning;
      throw error;
    }
    if (!isRecord(body) || !isRecord(body.result)) {
      const error = typedError('AI_INVALID_RESULT', 502, 'Der KI-Dienst hat eine unvollständige Antwort geliefert. Bitte erneut versuchen.');
      error.usageWarning = usageWarning;
      throw error;
    }
    return { result: body.result, usageWarning };
  }

  root.GlowUpAIClient = Object.freeze({ request });
})(globalThis);
