export function gameFailure(detail: string) {
  if (/^(?:Validation:\s*)?Artwork (?:review|preview)/i.test(detail)) return {
    kind: 'validation',
    message: /^(?:Validation:\s*)?Artwork review needs repairs:/i.test(detail)
      ? 'The new character still needs visual improvements after my repair attempts. I kept your previous game. You can try again.'
      : 'I couldn’t complete the visual check for the new character. I kept your previous game. Please try again.',
  };

  if (
    /^(?:Validation:\s*)?Unsupported (?:physics|feature|behavior|theme|game)\b/i.test(
      detail,
    )
  )
    return {
      kind: 'unsupported',
      message: `That feature isn’t supported by this game yet. ${detail}`,
    };
  if (/approval.*cancel|permission.*cancel/i.test(detail))
    return {
      kind: 'approval_cancelled',
      message:
        'The permission request was cancelled. Your idea and previous game are safe.',
    };
  if (/permission.*denied|approval.*denied/i.test(detail))
    return {
      kind: 'approval_denied',
      message:
        'That action wasn’t approved. Your previous game is still available.',
    };
  if (
    /UnsupportedParams|unsupported parameters|does not support parameters/i.test(
      detail,
    )
  )
    return {
      kind: 'model_configuration',
      message:
        'The model connection rejected a setting. Your idea is still here and your previous game is safe.',
    };
  if (/time.?out|timed out|response.*limit/i.test(detail))
    return {
      kind: 'timeout',
      message:
        'My run reached its time or response limit. Your idea wasn’t the problem; your previous game is safe.',
    };
  if (/interrupt|closed|reopen/i.test(detail))
    return {
      kind: 'interrupted',
      message:
        'Coco closed before finishing. I kept your previous game and your request.',
    };
  if (/stopped|abort/i.test(detail))
    return {
      kind: 'cancelled',
      message: 'That run was stopped. Your previous game is safe.',
    };
  if (/valid|schema|sprite|theme|engine|core|json|syntax/i.test(detail))
    return {
      kind: 'validation',
      message: `My game check found a problem: ${detail.replace(/^Validation:\s*/, '').slice(0, 230)}. I kept your previous game.`,
    };
  if (/not applied|without applying/i.test(detail))
    return {
      kind: 'no_change',
      message:
        'The model replied without applying the requested change. Your previous game is still here; I can try again.',
    };
  return {
    kind: 'model',
    message: `I couldn’t finish because the model or connection reported: ${detail.slice(0, 180)}. Your previous game is safe.`,
  };
}
export function requestsGameChange(text: string) {
  if (
    /\b(recommend|suggest|explain|how (does|do)|what (is|are|would|should)|why)\b/i.test(
      text,
    ) &&
    !/\b(and|then)\s+(make|change|add|replace)\b/i.test(text)
  )
    return false;
  return !/^(hi|hello|thanks|thank you)[.! ]*$/i.test(text.trim());
}
