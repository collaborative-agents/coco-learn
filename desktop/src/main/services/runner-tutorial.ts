import { needsArtReview, type ArtEvidence, type ArtVerdict } from '../game/art-review';
import fs from 'fs';
import { gameFailure, requestsGameChange } from './game-failure';
import path from 'path';
import { randomUUID } from 'crypto';
import ActiveRunClock from './active-run-clock';
import type { PermissionRequest } from '../../shared/agent-execution';
import { createHash } from 'crypto';
import {
  validateTheme,
  validatePlayerArtwork,
  applyThemePatch,
  describeThemeChanges,
  themeSchema,
  resolveTheme,
  type GameTheme,
} from '../game/theme-data';
import { gameHtml } from '../game/preview';
import template from '../../shared/runner-template.json';
import { flightBehavior, runningBehavior } from '../game/behavior-presets';
import originalTheme from '../game/theme.json';
import legacyTheme from '../game/legacy-theme.json';
import scenePresets from '../game/presets.json';
import type {
  RunnerGuide,
  RunnerTutorialState,
} from '../../shared/runner-tutorial';

interface RecordState {
  tour?: RunnerTutorialState['tour'];
  schemaVersion?: number;
  lastRequest?: string;
  summary?: string;
  introAcknowledged?: boolean;
  visualRevision?: number;
  sessionId: string;
  user: string;
  phase: RunnerTutorialState['phase'];
  history: string[];
  cursor: number;
  firstOver: boolean;
  coaches: string[];
  checked: boolean;
  bestScores?: Record<string, number>;
  error: string | null;
  failure?: RunnerTutorialState['failure'];
}
const editable = new Set(['theme.json', 'behavior.js']);
const files = template as Record<string, string>;

export default class RunnerTutorial {
  private validated = new Map<
    string,
    {
      fingerprint: string;
      sources: Record<string, string>;
      result: { changed: boolean; summary: string; html: string };
    }
  >();
  private watchers = new Map<string, { close: () => void }>();
  private previewErrors = new Map<string, string>();
  private draftThemes = new Map<string, GameTheme>();
  private records = new Map<string, RecordState>();
  private turnRequests = new Map<string, boolean>();
  private timers = new Map<string, ActiveRunClock>();
  constructor(
    private deps: {
      dataDir: string;
      node: string;
      validate?: (html: string) => Promise<void>;
      designArt?: (sessionId: string, request: string, theme: GameTheme, evidence: ArtEvidence) => Promise<GameTheme>;
      captureArt?: (html: string, theme: GameTheme) => Promise<ArtEvidence>;
      reviewArt?: (sessionId: string, request: string, evidence: ArtEvidence) => Promise<ArtVerdict>;
      changed: (user: string, state: RunnerTutorialState) => void;
      guide: (user: string, guide: RunnerGuide) => void;
    },
  ) {}
  private root(user: string) {
    return path.join(
      this.deps.dataDir,
      'runner-tutorial',
      encodeURIComponent(user),
    );
  }
  private record(user: string) {
    if (!this.records.has(user)) {
      try {
        const saved = JSON.parse(
          fs.readFileSync(path.join(this.root(user), 'state.json'), 'utf8'),
        ) as RecordState;
        if (
          saved.user === user &&
          /^[a-f0-9-]{36}$/.test(saved.sessionId) &&
          Array.isArray(saved.history) &&
          saved.history.every((x) => /^[a-f0-9-]{36}$/.test(x)) &&
          Number.isInteger(saved.cursor) &&
          saved.cursor >= 0 &&
          saved.cursor < saved.history.length &&
          Array.isArray(saved.coaches)
        ) {
          if (saved.phase === 'building') {
            saved.phase = 'writing';
            saved.failure = {
              ...gameFailure('interrupted'),
              detail: 'App closed mid-run',
            };
            saved.error = saved.failure.message;
          }
          this.records.set(user, saved);
          if (saved.schemaVersion !== 2) this.upgrade(saved);
          if (saved.visualRevision !== 2) this.upgradeVisuals(saved);
          if (saved.failure?.kind === 'interrupted') {
            this.restoreWork(saved);
            this.save(saved, false);
          }
        }
      } catch (error) {
        if (this.records.has(user)) throw error;
        /* A missing or invalid activity starts fresh. */
      }
    }
    return this.records.get(user);
  }
  private directory(r: RecordState) {
    return path.join(this.root(r.user), r.sessionId);
  }
  workspace(user: string, sessionId: string) {
    const r = this.record(user);
    return r?.sessionId === sessionId
      ? path.join(this.directory(r), 'work')
      : null;
  }
  owns(user: string | null, sessionId: string | null) {
    return Boolean(
      user &&
        sessionId &&
        this.record(user)?.sessionId === sessionId &&
        this.record(user)?.phase !== 'complete',
    );
  }
  state(user: string): RunnerTutorialState | null {
    const r = this.record(user);
    return r
      ? {
          sessionId: r.sessionId,
          version: r.history[r.cursor],
          phase: r.phase,
          canUndo: r.cursor > 0,
          hasChanges: r.cursor > 0,
          error: r.error,
          failure: r.failure,
          lastRequest: r.lastRequest,
          introAcknowledged: r.introAcknowledged,
          firstGameOver: r.firstOver,
          tour: r.tour,
          previewRevision: this.draftThemes.has(user)
            ? createHash('sha256')
                .update(JSON.stringify(this.draftThemes.get(user)))
                .digest('hex')
            : r.history[r.cursor],
          previewError: this.previewErrors.get(user),
          previewKind: this.draftThemes.has(user)
            ? 'checking'
            : r.cursor > 0
              ? 'updated'
              : 'original',
        }
      : null;
  }
  private save(r: RecordState, notify = true) {
    fs.mkdirSync(this.root(r.user), { recursive: true });
    const target = path.join(this.root(r.user), 'state.json');
    fs.writeFileSync(target + '.tmp', JSON.stringify(r), 'utf8');
    fs.renameSync(target + '.tmp', target);
    this.records.set(r.user, r);
    if (notify) this.deps.changed(r.user, this.state(r.user)!);
  }
  private guide(
    r: RecordState,
    text: string,
    label = 'COCO',
    action?: RunnerGuide['action'],
    actionLabel?: string,
    status: RunnerGuide['status'] = 'observing',
  ) {
    this.deps.guide(r.user, {
      sessionId: r.sessionId,
      text,
      label,
      action,
      actionLabel,
      status,
    });
  }
  start(user: string) {
    const old = this.record(user);
    if (old && old.phase !== 'complete') {
      if (old.phase === 'play') this.intro(user);
      else
        this.guide(
          old,
          'Your game is ready. Let’s pick up where you left off.',
          'WELCOME BACK',
          'focus',
          'Back to my idea',
        );
      return this.state(user)!;
    }
    const r: RecordState = {
      schemaVersion: 2,
      visualRevision: 2,
      tour: old?.tour === 'finished' || old?.tour === 'skipped' ? old.tour : undefined,
      user,
      sessionId: randomUUID(),
      phase: 'play',
      history: [randomUUID()],
      cursor: 0,
      firstOver: false,
      coaches: [],
      checked: false,
      error: null,
    };
    const initial = path.join(this.directory(r), 'versions', r.history[0]);
    fs.mkdirSync(initial, { recursive: true });
    for (const [name, source] of Object.entries(files))
      fs.writeFileSync(path.join(initial, name), source, 'utf8');
    this.restoreWork(r);
    this.save(r);
    this.intro(user);
    return this.state(user)!;
  }
  startTour(user: string) {
    const existing = this.record(user);
    if (existing?.tour === 'finished' && existing.phase === 'complete') return this.start(user);
    if (!this.record(user)) this.start(user);
    const r = this.record(user)!;
    if (!r.tour || r.tour === 'skipped') {
      r.tour = 'meet';
      // An existing account keeps its game and every saved version.
      if (r.phase === 'complete') r.phase = r.cursor ? 'review' : 'play';
      this.save(r);
    }
    if (r.tour === 'meet') this.guide(r,
      'Play a round, then tell me how you’d like to change the game. I’ll help bring your idea to life!',
      'PLAY WITH COCO');
    return this.state(user)!;
  }
  tourAction(user: string, action: 'tour-play' | 'why-tips' | 'explain-buttons' | 'skip-tour' | 'finish-setup') {
    const r = this.record(user);
    if (!r) throw Error('Open your Coco tour first.');
    if (action === 'why-tips') {
      this.guide(r, 'With your permission, I notice what you’re working on and suggest ideas. You can close any tip with ✕ and pause observation in Settings.', 'WHY TIPS?');
    } else if (action === 'explain-buttons') {
      this.guide(r, 'Undo change goes back one version. Make it yours lets you ask for another change. Looks good finishes this task when you’re happy. Play first and check my work!', 'YOUR BUTTONS');
    } else if (action === 'tour-play') {
      r.tour = 'active';
      this.playing(user);
    } else {
      if (r.phase === 'building') throw Error('Wait for Coco to stop before leaving the tour.');
      if (action === 'finish-setup' && r.tour !== 'done') throw Error('Finish reviewing your game first.');
      r.tour = action === 'skip-tour' ? 'skipped' : 'finished';
      this.save(r);
    }
    return this.state(user)!;
  }
  intro(user: string) {
    const r = this.record(user);
    if (!r) return;
    this.guide(
      r,
      "Let's introduce you to what Coco can do with a simple little game!",
      'LET’S PLAY',
      'play',
      'Let’s play',
    );
  }
  playing(user: string) {
    const r = this.record(user);
    if (!r) return;
    r.introAcknowledged = true;
    this.save(r);
    this.guide(r, "Play the game, then let's make it your own! Click the 'Make it yours' button.", 'LET’S PLAY');
  }
  recordScore(
    user: string,
    sessionId: string,
    version: string,
    score: unknown,
  ) {
    const r = this.record(user);
    if (
      !r ||
      r.sessionId !== sessionId ||
      r.history[r.cursor] !== version ||
      typeof score !== 'number' ||
      !Number.isInteger(score) ||
      score < 0 ||
      score > 100000000
    )
      return;
    r.bestScores ??= {};
    if (score > (r.bestScores[version] ?? 0)) {
      r.bestScores[version] = score;
      this.save(r, false);
    }
  }
  firstGameOver(user: string) {
    const r = this.record(user);
    if (!r || r.firstOver || r.phase !== 'play') return;
    r.firstOver = true;
    this.save(r);
    if (!r.introAcknowledged) return;
    this.guide(
      r,
      'Want to make this game yours? Tell me what you want.',
      'YOUR TURN',
      'customize',
      'Make it yours',
    );
  }
  writing(user: string) {
    const r = this.record(user);
    if (!r || r.phase === 'building') throw Error('Wait for Coco to finish.');
    r.phase = 'writing';
    r.error = null;
    if (!r.coaches.includes('start')) r.coaches.push('start');
    this.save(r);
    this.guide(
      r,
      'Try one of the examples in chat, or tell me your own idea. I can change how the game looks and how you play!',
      'YOUR WORDS',
    );
  }
  coach(user: string, sessionId: string, draft: string) {
    const r = this.record(user);
    if (
      !r ||
      r.sessionId !== sessionId ||
      !['writing', 'review'].includes(r.phase) ||
      r.coaches.length >= 3 ||
      draft.trim().length < 5
    )
      return;
    const words = draft.trim().toLowerCase();
    let kind = 'clear',
      text = 'Nice and clear! Try “Check my understanding” before you send.';
    if (!r.checked && r.coaches.length >= 2 && !r.coaches.includes('check')) {
      kind = 'check';
      text =
        'Try “Check my understanding” before sending. I’ll repeat your idea back.';
    } else if (
      words.split(/\s+/).length < 5 ||
      /^(make (it|this) (cooler|better|fun)|change it)[.! ]*$/.test(words)
    ) {
      kind = 'vague';
      text = 'Name a time of day, character, or vibe you have in mind. Your own words are enough!';
    } else if (
      !/spooky|cute|retro|pixel|cozy|dark|bright|morning|sunny|dawn|detailed|realistic|watercolor|watercolour|pet|dog|cat|color|colour|space|forest|ocean|desert|sunset|night|rainbow|pink|blue|red|green|purple/.test(
        words,
      )
    ) {
      kind = 'look';
      text = 'What should it feel like: spooky, cute, or retro?';
    }
    if (r.coaches.includes(kind)) return;
    r.coaches.push(kind);
    this.save(r);
    this.guide(
      r,
      text,
      'IDEA',
      kind === 'clear' || kind === 'check' ? 'focus' : undefined,
      kind === 'clear' || kind === 'check' ? 'Back to my idea' : undefined,
    );
  }
  checked(user: string, sessionId: string, interpretation: string) {
    const r = this.record(user);
    if (!r || r.sessionId !== sessionId || r.phase === 'complete') return;
    r.checked = true;
    this.save(r);
    this.guide(
      r,
      interpretation.slice(0, 210),
      'DID I GET IT?',
      'focus',
      'Back to my idea',
    );
  }
  private snapshot(r: RecordState) {
    return path.join(this.directory(r), 'versions', r.history[r.cursor]);
  }
  private upgrade(r: RecordState) {
    // Keep all legacy versions and their state on disk; never overwrite old artwork.
    fs.writeFileSync(
      path.join(this.directory(r), 'legacy-state.json'),
      JSON.stringify(r),
    );
    const id = randomUUID(),
      target = path.join(this.directory(r), 'versions', id);
    fs.mkdirSync(target, { recursive: true });
    for (const [name, source] of Object.entries(files))
      fs.writeFileSync(path.join(target, name), source);
    r.history = [id];
    r.cursor = 0;
    r.schemaVersion = 2;
    r.phase = 'writing';
    this.save(r, false);
    this.restoreWork(r);
  }
  private upgradeVisuals(r: RecordState) {
    // Retain every old version and a recoverable state map; preserve custom art/rules.
    const backup = r.visualRevision === 1 ? 'before-tour-art-upgrade.json' : 'before-visual-upgrade.json';
    fs.writeFileSync(path.join(this.directory(r), backup), JSON.stringify(r));
    const history = r.history.map(oldId => {
      const source = path.join(this.directory(r), 'versions', oldId);
      const old = JSON.parse(fs.readFileSync(path.join(source, 'theme.json'), 'utf8')) as GameTheme;
      const preset = scenePresets[old.timeOfDay as keyof typeof scenePresets] ?? scenePresets.night;
      const next = { ...originalTheme, ...old, scene: old.scene ?? preset.scene } as GameTheme;
      next.scene = structuredClone(next.scene);
      const layers = next.scene.layers;
      const forest = layers.find(layer => layer.kind === 'forest');
      if (forest && layers.filter(layer => layer.kind === 'forest').length === 1 && layers.length < 8) {
        layers.splice(layers.indexOf(forest), 0, { ...forest, speed: forest.speed * .65, scale: .62, density: 24, seed: 68 });
      }
      for (const layer of layers) if (layer.kind === 'mountains' && !layer.capColor) {
        layer.capColor = next.scene.sky.at(-1)!;
        layer.capDepth = 8;
      }
      if (JSON.stringify(old.ground) === JSON.stringify(legacyTheme.ground)) next.ground = preset.ground;
      if (JSON.stringify(old.background) === JSON.stringify(legacyTheme.background)) next.background = preset.background;
      if (old.title === 'Moonlit Run') next.title = preset.title;
      if (JSON.stringify(old.player.frames) === JSON.stringify(legacyTheme.player.frames)) {
        next.player = originalTheme.player;
        next.spritePalette = { ...originalTheme.spritePalette, ...old.spritePalette };
        if (old.spritePalette.o !== legacyTheme.spritePalette.o) next.spritePalette.a = old.spritePalette.o;
      }
      const theme = resolveTheme(next);
      validateTheme(theme);
      const id = randomUUID(), target = path.join(this.directory(r), 'versions', id);
      if (r.bestScores?.[oldId] != null) r.bestScores[id] = r.bestScores[oldId];
      fs.mkdirSync(target, { recursive: true });
      for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(target, name), content);
      fs.writeFileSync(path.join(target, 'theme.json'), JSON.stringify(theme, null, 2));
      fs.copyFileSync(path.join(source, 'behavior.js'), path.join(target, 'behavior.js'));
      return id;
    });
    r.history = history;
    r.visualRevision = 2;
    this.save(r, false);
    this.restoreWork(r);
  }
  private restoreWork(r: RecordState) {
    this.watchers.get(r.user)?.close();
    this.watchers.delete(r.user);
    this.draftThemes.delete(r.user);
    this.previewErrors.delete(r.user);
    const work = path.join(this.directory(r), 'work');
    fs.rmSync(work, { recursive: true, force: true });
    fs.mkdirSync(work, { recursive: true });
    for (const name of Object.keys(files))
      fs.copyFileSync(path.join(this.snapshot(r), name), path.join(work, name));
    let timer: ReturnType<typeof setTimeout>;
    const watched = path.join(work, 'theme.json');
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const theme = JSON.parse(
            fs.readFileSync(path.join(work, 'theme.json'), 'utf8'),
          );
          validateTheme(theme);
          this.previewErrors.delete(r.user);
          this.draftThemes.set(r.user, theme);
          this.deps.changed(r.user, this.state(r.user)!);
          if (
            r.phase !== 'building' &&
            JSON.stringify(theme) !==
              JSON.stringify(
                JSON.parse(
                  fs.readFileSync(
                    path.join(this.snapshot(r), 'theme.json'),
                    'utf8',
                  ),
                ),
              )
          ) {
            r.phase = 'building';
            r.error = null;
            r.failure = undefined;
            r.lastRequest = 'Apply my theme file edit';
            this.turnRequests.set(r.sessionId, true);
            this.save(r);
            void this.finish(r.user, r.sessionId, true);
          }
        } catch (error) {
          this.previewErrors.set(
            r.user,
            `The theme file isn’t valid yet. Showing the last working preview. ${error instanceof Error ? error.message : String(error)}`,
          );
          this.deps.changed(r.user, this.state(r.user)!);
        }
      }, 80);
    };
    fs.watchFile(watched, { interval: 150, persistent: false }, refresh);
    this.watchers.set(r.user, {
      close: () => {
        clearTimeout(timer);
        fs.unwatchFile(watched, refresh);
      },
    });
  }
  private artistRuns = new Set<string>();
  tools(user: string, sessionId: string) {
    const r = this.record(user);
    if (!r || r.sessionId !== sessionId)
      throw Error('This game is no longer active.');
    return {
      schema: themeSchema,
      designCharacter: async (description: string) => {
        if (r.phase !== 'building' || !this.deps.captureArt || !this.deps.designArt) throw Error('The character artist is unavailable.');
        if (!this.artistRuns.has(sessionId)) { this.artistRuns.add(sessionId); this.timers.get(sessionId)?.extendDeadline(120000); }
        const request = r.lastRequest;
        const work = this.workspace(user, sessionId)!;
        const current = JSON.parse(fs.readFileSync(path.join(work, 'theme.json'), 'utf8')) as GameTheme;
        const html = gameHtml(files['engine.js'], fs.readFileSync(path.join(work, 'behavior.js'), 'utf8'), current, 'artist-reference');
        this.guide(r, 'I’m drawing your character to match Coco’s style and scale.', 'DRAWING YOUR CHARACTER');
        const evidence = await this.deps.captureArt(html, current);
        const next = await this.deps.designArt(sessionId, `${request}\nCharacter details / repair feedback: ${description}`, current, evidence);
        if (r.phase !== 'building' || r.lastRequest !== request) throw Error('This character design was stopped.');
        return this.tools(user, sessionId).updateTheme({player: next.player, spritePalette: next.spritePalette});
      },
      inspectArtwork: async () => {
        if (r.phase !== 'building' || !this.deps.captureArt) throw Error('Artwork preview is unavailable.');
        const work = this.workspace(user, sessionId)!;
        const theme = JSON.parse(fs.readFileSync(path.join(work, 'theme.json'), 'utf8'));
        validateTheme(theme);
        const html = gameHtml(files['engine.js'], fs.readFileSync(path.join(work, 'behavior.js'), 'utf8'), theme, 'art-preview');
        const evidence = await this.deps.captureArt(html, theme);
        if (!this.deps.reviewArt) throw Error('Artwork review is unavailable.');
        const review = await this.deps.reviewArt(sessionId, r.lastRequest ?? '', evidence);
        return { ...evidence, description: JSON.stringify(review) };
      },
      updateTheme: (changes: unknown) => {
        if (r.phase !== 'building')
          throw Error('Start a game change before updating its theme.');
        const target = path.join(
          this.workspace(user, sessionId)!,
          'theme.json',
        );
        let current: GameTheme;
        try {
          current = JSON.parse(fs.readFileSync(target, 'utf8'));
        } catch {
          current =
            this.draftThemes.get(user) ??
            JSON.parse(
              fs.readFileSync(
                path.join(this.snapshot(r), 'theme.json'),
                'utf8',
              ),
            );
        }
        let next: GameTheme;
        try {
          next = applyThemePatch(current, changes);
          validatePlayerArtwork(current, next, r.lastRequest);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          const physics = (changes as { physics?: Record<string, unknown> })
            ?.physics;
          if (
            physics &&
            Object.values(physics).some(
              (value) => typeof value === 'number' && value < 0,
            )
          )
            r.failure = {
              ...gameFailure(`Unsupported physics: ${detail}`),
              detail: `Unsupported physics: ${detail}`,
            };
          throw error;
        }
        fs.writeFileSync(target + '.tmp', JSON.stringify(next, null, 2));
        if (next.controls?.mode !== current.controls?.mode || (changes as {behaviorPreset?:string})?.behaviorPreset) {
          const behavior = path.join(this.workspace(user, sessionId)!, 'behavior.js');
          fs.writeFileSync(behavior + '.tmp', next.controls?.mode === 'fly' ? flightBehavior : runningBehavior);
          fs.renameSync(behavior + '.tmp', behavior);
        }
        fs.renameSync(target + '.tmp', target);
        this.previewErrors.delete(user);
        this.draftThemes.set(user, next);
        this.deps.changed(user, this.state(user)!);
        return { ok: true, ...describeThemeChanges(current, next) };
      },
    };
  }
  begin(
    user: string,
    sessionId: string,
    cancel: () => void,
    text = 'make a change',
  ) {
    const r = this.record(user);
    if (!r || r.sessionId !== sessionId || r.phase === 'complete') return null;
    if (r.phase === 'building')
      throw Error('Coco is already changing this game.');
    this.artistRuns.delete(sessionId);
    r.lastRequest = text;
    this.turnRequests.set(sessionId, requestsGameChange(text));
    this.restoreWork(r);
    r.phase = 'building';
    r.error = null;
    r.failure = undefined;
    const invalidPhysics = text.match(
      /\b(gravity|speed)\b\s*(?:to|=|:)?\s*(-\d+(?:\.\d+)?)/i,
    );
    if (invalidPhysics && this.turnRequests.get(sessionId)) {
      const detail = `Unsupported physics: ${invalidPhysics[1]} cannot be ${invalidPhysics[2]}; it must be positive and within the documented range.`;
      r.failure = { ...gameFailure(detail), detail };
    }
    this.save(r);
    this.guide(
      r,
      'A chatbot would tell you how. I’m actually doing it: making the change and checking that it works.',
      'MAKING YOUR GAME',
    );
    this.timers.set(
      sessionId,
      new ActiveRunClock([
        {
          after: 45000,
          action: () => {
            if (r.phase === 'building')
              this.guide(
                r,
                'I’m still working. Your previous game is safe.',
                'STILL WORKING',
              );
          },
        },
        {
          after: 120000,
          action: () => {
            r.failure = { ...gameFailure('timeout'), detail: 'timeout' };
            cancel();
          },
        },
      ]),
    );
    return `${files['GUIDE.md']}

Worked examples (partial changes):
${files['examples.json']}

Current theme summary: ${JSON.stringify(this.themeSummary(r))}

Read theme.json only if you need values not covered by the schema or summary. Prefer one update_game_theme call, then a short explanation of the actual changes. The app owns testing and publishing.`;
  }
  private themeSummary(r: RecordState) {
    const t = JSON.parse(
      fs.readFileSync(path.join(this.snapshot(r), 'theme.json'), 'utf8'),
    ) as GameTheme;
    return {
      title: t.title,
      timeOfDay: t.timeOfDay,
      detail: t.detail,
      background: t.background,
      player: t.player.name,
      obstacles: t.obstacles.map((o) => o.name),
      weather: t.weather,
      physics: t.physics,
      sounds: t.sounds,
      controls: t.controls,
      decorations: t.decorations.map(d=>d.kind),
    };
  }

  permission(user: string, sessionId: string, request: PermissionRequest) {
    const r = this.record(user);
    if (!r || r.sessionId !== sessionId || r.phase !== 'building') return;
    this.timers
      .get(sessionId)
      ?.permission(request.id, request.status === 'pending');
    if (request.status === 'cancelled' || request.status === 'denied')
      this.guide(r, 'That action wasn’t allowed. I’ll use the game tools where possible; the app still checks every change before publishing.', 'PERMISSION DECLINED');
    if (request.status === 'pending')
      this.guide(
        r,
        'I ask before running commands on your computer. Review this request in chat; my timer is paused. The game’s built-in check needs no extra permission.',
        'WAITING FOR YOU',
        'focus',
        'Review request',
      );
  }
  private stopTimers(sessionId: string) {
    this.timers.get(sessionId)?.stop();
    this.timers.delete(sessionId);
  }
  async check(user: string, sessionId: string) {
    const r = this.record(user);
    if (!r || r.sessionId !== sessionId)
      throw Error('This game is no longer active.');
    const work = this.workspace(user, sessionId)!;
    const sources: Record<string, string> = {};
    for (const name of Object.keys(files)) {
      const file = path.join(work, name),
        stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 200000)
        throw Error(`Invalid game file: ${name}`);
      sources[name] = fs.readFileSync(file, 'utf8');
      if (
        !editable.has(name) &&
        fs.readFileSync(file, 'utf8') !==
          fs.readFileSync(path.join(this.snapshot(r), name), 'utf8')
      )
        throw Error(
          `The stable engine file ${name} was changed. Restore it and edit theme.json or behavior.js only.`,
        );
    }
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(sources))
      .digest('hex');
    const cached = this.validated.get(sessionId);
    if (cached?.fingerprint === fingerprint) return cached.result;
    const theme = JSON.parse(sources['theme.json']);
    validateTheme(theme);
    // A valid JSON theme can still miss a clear daylight request. Return this
    // concrete mismatch to the existing repair loop, rather than publishing a
    // blue night sky as a successful daylight change. Respect explicit requests
    // to keep night elements or to change away from daylight.
    const ask = r.lastRequest ?? '';
    const wantsDaylight = this.turnRequests.get(sessionId) &&
      /\b(?:make|change|chnge|switch|turn|want|convert)\b[\s\S]*\b(?:daylight|daylite)\b/i.test(ask) &&
      !/\b(?:from|not|no|without)\s+(?:a\s+)?(?:daylight|daylite)\b|\bkeep\s+(?:the\s+)?(?:night|moon|title)\b/i.test(ask);
    if (wantsDaylight && (!['day', 'morning'].includes(theme.timeOfDay) ||
      theme.decorations.some(d => d.kind === 'moon') ||
      theme.title === scenePresets.night.title)) {
      throw Error('The request asks for daylight, but the game still has a night time, moon, or automatic Moonlit title. Use update_game_theme with timeOfDay: "day" so the sky, sun, scenery, and automatic title agree. Preserve the runner, obstacles, and physics unless the user asked to change them.');
    }
    const before = JSON.parse(
      fs.readFileSync(path.join(this.snapshot(r), 'theme.json'), 'utf8'),
    ) as GameTheme;
    validatePlayerArtwork(before, theme, r.lastRequest);
    const result = describeThemeChanges(before, theme);
    const behaviorChanged =
      fs.readFileSync(path.join(work, 'behavior.js'), 'utf8') !==
      fs.readFileSync(path.join(this.snapshot(r), 'behavior.js'), 'utf8');
    if (!result.changed.length && !behaviorChanged) {
      if (r.failure?.kind === 'unsupported') throw Error(r.failure.detail);
      if (this.turnRequests.get(sessionId))
        throw Error(
          'The requested change was not applied. Use update_game_theme to make it.',
        );
      return { changed: false, summary: '', html: '' };
    }
    this.guide(r, 'I’m checking the game and its controls.', 'TESTING IT');
    const html = gameHtml(
      sources['engine.js'],
      sources['behavior.js'],
      theme,
      r.history[r.cursor],
    );
    if (!this.deps.validate)
      throw Error('The browser game checker is unavailable.');
    await this.deps.validate(html);
    if (needsArtReview(before, theme)) {
      this.guide(r, 'I’m comparing the new character with Coco’s artwork and checking its animation.', 'CHECKING THE ARTWORK');
      if (!this.deps.captureArt || !this.deps.reviewArt)
        throw Error('Artwork review is unavailable. The custom character cannot be published yet.');
      const evidence = await this.deps.captureArt(html, theme);
      const folder = path.join(this.directory(r), 'art-reviews', fingerprint);
      fs.mkdirSync(folder, { recursive: true });
      for (const [name, data] of Object.entries({contactSheet: evidence.contactSheet, scene: evidence.scene}))
        fs.writeFileSync(path.join(folder, name + '.png'), Buffer.from(data.split(',')[1], 'base64'));
      const verdict = await this.deps.reviewArt(sessionId, r.lastRequest ?? '', evidence);
      fs.writeFileSync(path.join(folder, 'review.json'), JSON.stringify(verdict, null, 2));
      if (!verdict.pass) throw Error('Artwork review needs repairs: ' + verdict.defects.join('; '));
    }
    const checked = {
      changed: true,
      summary: behaviorChanged
        ? result.summary + ' I also updated the game rules.'
        : result.summary,
      html,
    };
    this.validated.set(sessionId, { fingerprint, sources, result: checked });
    return checked;
  }
  async finish(
    user: string,
    sessionId: string,
    success: boolean,
    detail = 'That run was stopped.',
  ) {
    this.stopTimers(sessionId);
    const r = this.record(user);
    if (!r || r.sessionId !== sessionId || r.phase !== 'building') return;
    if (!success) return this.fail(r, r.failure?.detail ?? detail);
    try {
      const result = await this.check(user, sessionId);
      if (r.phase !== 'building') return; // The user may skip while the browser checks.
      if (!result.changed) {
        this.draftThemes.delete(user);
        r.phase = r.cursor > 0 ? 'review' : 'writing';
        if (this.turnRequests.get(sessionId))
          return this.fail(
            r,
            'The model finished without applying the requested change.',
          );
        this.save(r);
        return;
      }
      const id = randomUUID(),
        snapshot = path.join(this.directory(r), 'versions', id);
      fs.mkdirSync(snapshot, { recursive: true });
      const checked = this.validated.get(sessionId)!;
      for (const [name, source] of Object.entries(checked.sources))
        fs.writeFileSync(path.join(snapshot, name), source);
      r.history = [...r.history.slice(0, r.cursor + 1), id];
      r.cursor = r.history.length - 1;
      r.phase = 'review';
      r.error = null;
      r.failure = undefined;
      r.summary = result.summary;
      this.draftThemes.delete(user);
      this.save(r);
      this.guide(
        r,
        `${result.summary} Play a round and check whether it matches what you imagined.`,
        'TRY YOUR GAME',
        'explain-buttons',
        'What are these buttons?',
        'progress',
      );
      return true;
    } catch (error) {
      return this.fail(
        r,
        `Validation: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  summary(user: string, sessionId: string) {
    const r = this.record(user);
    return r?.sessionId === sessionId ? r.summary : undefined;
  }
  repair(user: string, sessionId: string, detail: string, attempt: number) {
    const r = this.record(user);
    if (!r || r.sessionId !== sessionId) return;
    if (r.failure?.kind === 'unsupported') return;
    this.guide(
      r,
      `My check found a problem. I’m fixing it (attempt ${attempt} of 2).`,
      'FIXING MY WORK',
    );
    return `The app reported: ${detail}. Repair this problem yourself, preserving the user's full request. Edit theme.json through update_game_theme or file tools, and behavior.js only for rules. Do not run commands. The app will test again.`;
  }
  private fail(r: RecordState, detail: string) {
    const schemaPassed = this.validated.has(r.sessionId);
    r.phase = 'writing';
    r.failure = { ...gameFailure(detail), detail };
    r.error =
      r.failure.message +
      (schemaPassed ? ' No new version was published.' : '');
    this.validated.delete(r.sessionId);
    this.restoreWork(r);
    this.save(r);
    this.guide(r, r.error, 'LET’S TRY AGAIN', 'retry', 'Try again');
    return false;
  }
  interrupt() {
    for (const r of this.records.values())
      if (r.phase === 'building') {
        r.failure = {
          ...gameFailure('App closed mid-run'),
          detail: 'App closed mid-run',
        };
        r.error = r.failure.message;
        this.save(r, false);
      }
  }
  newGame(user: string) {
    const old = this.record(user);
    if (old?.phase === 'building')
      throw Error('Wait for the current game change to finish.');
    if (old) {
      old.phase = 'complete';
      this.save(old, false);
    }
    return this.start(user);
  }
  dispose() {
    for (const watcher of this.watchers.values()) watcher.close();
    this.watchers.clear();
    for (const clock of this.timers.values()) clock.stop();
    this.timers.clear();
  }
  undo(user: string) {
    const r = this.record(user);
    if (!r || r.phase === 'building' || r.cursor === 0)
      throw Error('No previous version is ready.');
    r.cursor -= 1;
    r.phase = 'review';
    r.error = null;
    this.restoreWork(r);
    this.save(r);
    this.guide(
      r,
      'Your previous game is back. Want to try a different change?',
      'UNDONE',
      'focus',
      'Back to my idea',
    );
    return this.state(user)!;
  }
  complete(user: string) {
    const r = this.record(user);
    if (!r || !['review','writing'].includes(r.phase) || r.cursor === 0)
      throw Error('Play your changed game first.');
    r.phase = 'complete';
    if (r.tour === 'active') r.tour = 'done';
    this.save(r);
    this.guide(
      r,
      'Your idea became a working game. Keep asking in your own words and checking what AI makes.',
      'YOU DID IT',
      r.tour === 'done' ? 'finish-setup' : 'finish',
      r.tour === 'done' ? 'Finish task' : 'Continue',
      'progress',
    );
  }
  private html(root: string, best = 0, version = '', override?: GameTheme) {
    const theme =
      override ??
      JSON.parse(fs.readFileSync(path.join(root, 'theme.json'), 'utf8'));
    validateTheme(theme);
    return gameHtml(
      fs.readFileSync(path.join(root, 'engine.js'), 'utf8'),
      fs.readFileSync(path.join(root, 'behavior.js'), 'utf8'),
      theme,
      version,
      best,
    );
  }
  preview(user: string) {
    const r = this.record(user);
    const theme = r ? this.draftThemes.get(user) ?? JSON.parse(fs.readFileSync(path.join(this.snapshot(r), 'theme.json'), 'utf8')) as GameTheme : null;
    return r
      ? {
          state: this.state(user)!,
          title: theme!.title,
          timeOfDay: theme!.timeOfDay,
          html: this.html(
            this.snapshot(r),
            r.bestScores?.[r.history[r.cursor]] ?? 0,
            r.history[r.cursor],
            this.draftThemes.get(user),
          ),
        }
      : null;
  }
}
