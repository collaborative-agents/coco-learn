import {
  shouldOfferInstantSuggestion,
  shouldSurfaceObservation,
} from '../main/services/intervention-policy';

describe('AI Upskilling intervention policy', () => {
  const rawObserverEvent = {
    type: 'snapshot',
    status: 'stuck',
  };
  const judgeEvent = {
    type: 'struggle',
    status: 'stuck',
    intervention_source: 'judge',
  };

  it('shows raw observer status bubbles without generating a suggestion', () => {
    expect(
      shouldOfferInstantSuggestion('ai_upskilling', false, rawObserverEvent),
    ).toBe(false);
    expect(shouldSurfaceObservation(rawObserverEvent)).toBe(true);
  });

  it('preserves the observer-owned pre-session invitation event', () => {
    const invite = {
      type: 'snapshot',
      status: 'task_suggested',
    };
    expect(shouldSurfaceObservation(invite)).toBe(true);
    expect(shouldOfferInstantSuggestion('ai_upskilling', false, invite)).toBe(
      false,
    );
  });

  it('does not let raw observer classifications bypass the Judge in-session', () => {
    expect(
      shouldOfferInstantSuggestion('ai_upskilling', true, rawObserverEvent),
    ).toBe(false);
    expect(shouldSurfaceObservation(rawObserverEvent)).toBe(true);
  });

  it('surfaces Judge-approved interventions during an active session', () => {
    expect(
      shouldOfferInstantSuggestion('ai_upskilling', true, judgeEvent),
    ).toBe(true);
    expect(shouldSurfaceObservation(judgeEvent)).toBe(true);
  });

  it('keeps progress quiet while preserving other observations', () => {
    expect(shouldSurfaceObservation({ status: 'progress' })).toBe(false);
    expect(shouldSurfaceObservation({ status: 'observing' })).toBe(true);
    expect(shouldSurfaceObservation(rawObserverEvent)).toBe(true);
    expect(
      shouldOfferInstantSuggestion('everyday_support', false, rawObserverEvent),
    ).toBe(true);
  });
});
