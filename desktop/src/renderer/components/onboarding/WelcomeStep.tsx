import cocoHelping from '../../../../assets/pet1.png';
import cocoReady from '../../../../assets/wait1.png';
import PetMenuIcon from '../PetMenuIcon';
import ObservationBubble from '../ObservationBubble';

export default function WelcomeStep() {
  return (
    <div className="ob-welcome-features">
      <div className="coco-setup-panel coco-setup-panel-padded ob-feature-card">
        <div
          className="ob-feature-scene"
          role="img"
          aria-label="Coco introducing your floating desktop companion"
        >
          <img
            className="ob-feature-illustration"
            src={cocoHelping}
            alt=""
            draggable={false}
          />
          <div className="ob-feature-bubble" inert aria-hidden="true">
            <ObservationBubble
              bubble={{
                status: 'observing',
                phrase:
                  'I’m Coco, your floating desktop companion. I can offer helpful tips while you work and help turn your ideas into action.',
                fadingOut: false,
                guide: { label: 'MEET COCO' },
              }}
            />
          </div>
        </div>
        <div className="ob-feature-copy">
          <strong>Your floating desktop companion</strong>
          <span>
            Keep Coco alongside your work for ideas, guidance, and a conversation
            whenever you need one.
          </span>
        </div>
      </div>
      <div className="coco-setup-panel coco-setup-panel-padded ob-feature-card">
        <div
          className="ob-feature-scene"
          role="img"
          aria-label="Coco’s menu with Chat highlighted"
        >
          <img
            className="ob-feature-illustration"
            src={cocoReady}
            alt=""
            draggable={false}
          />
          <div className="ob-feature-menu" aria-hidden="true">
            <div className="ob-feature-menu-active">
              <PetMenuIcon name="chat" />
              Chat
            </div>
            <div>
              <PetMenuIcon name="settings" />
              Settings
            </div>
            <div>
              <PetMenuIcon name="hide" />
              Hide
            </div>
          </div>
        </div>
        <div className="ob-feature-copy">
          <strong>A conversation away</strong>
          <span>
            Open chat from Coco’s avatar or the menu-bar icon and ask anything.
          </span>
        </div>
      </div>
    </div>
  );
}
