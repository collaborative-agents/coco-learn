import foxWorking from '../../../../assets/pet1.png';
import ObservationBubble from '../ObservationBubble';
import '../../App.css';

function DesktopPreview({
  hidden,
  selected,
}: {
  hidden: boolean;
  selected: boolean;
}) {
  return (
    <span
      className={`ob-desktop-preview ${hidden ? 'is-menu-only' : 'has-avatar'} ${selected ? 'is-selected' : ''}`}
      aria-hidden="true"
      inert
    >
      <span className="ob-preview-menubar">
        <span />
        <img src={foxWorking} alt="" />
      </span>
      <span className="ob-preview-window">
        <i />
        <i />
        <i />
      </span>
      {!hidden && <img className="ob-preview-avatar" src={foxWorking} alt="" />}
      <span className="ob-preview-advice">
        <ObservationBubble
          bubble={{
            status: 'observing',
            phrase: 'Want a hand with this?',
            fadingOut: false,
            guide: { label: 'IDEA', action: 'Help me with this' },
          }}
        />
      </span>
    </span>
  );
}

export default function AvatarStep({
  hidden,
  onChange,
}: {
  hidden: boolean;
  onChange: (hidden: boolean) => void;
}) {
  return (
    <>
      <div
        className="coco-setup-panel ob-avatar-options"
        role="radiogroup"
        aria-label="Avatar visibility"
      >
        {[false, true].map((hide) => (
          <label
            htmlFor={hide ? 'ob-hide-avatar' : 'ob-reveal-avatar'}
            key={String(hide)}
            className={`ob-avatar-option ${hidden === hide ? 'selected' : ''}`}
          >
            <input
              id={hide ? 'ob-hide-avatar' : 'ob-reveal-avatar'}
              type="radio"
              name="avatar-visibility"
              value={hide ? 'hide' : 'reveal'}
              checked={hidden === hide}
              onChange={() => onChange(hide)}
            />
            <span className="ob-setting-copy">
              <strong>{hide ? 'Menu bar only' : 'Avatar + menu bar'}</strong>
              <span>
                {hide
                  ? 'Get my suggestions from your menu bar.'
                  : 'A desktop fox, plus quick access from your menu bar.'}
              </span>
            </span>
            <DesktopPreview hidden={hide} selected={hidden === hide} />
          </label>
        ))}
      </div>
    </>
  );
}
