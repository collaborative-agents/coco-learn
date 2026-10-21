type Point = { x: number; y: number };
type Size = { width: number; height: number };
type Area = Point & Size;

const AVATAR_FOOTPRINT = 180;
const BUBBLE_SCREEN_MARGIN = 8;
// Where the card sat when it lived inside the avatar window: its right edge
// 18px inside Coco's footprint and its bottom edge 24px above the footprint's
// bottom, so the tail points at the pet.
const CARD_INSET_X = 18;
const CARD_BOTTOM_INSET = 24;

export type AvatarBubbleSide = 'left' | 'right';

/**
 * Screen position of the observation bubble's card (its top-left corner). The
 * card sits to the left of Coco; with no room there it moves to Coco's right.
 * Either way it is kept inside the work area, sliding down rather than
 * pushing Coco when Coco is parked near the top of the screen.
 */
export function placeAvatarBubble(
  footprint: Point,
  card: Size,
  workArea: Area,
): Point & { side: AvatarBubbleSide } {
  const minX = workArea.x + BUBBLE_SCREEN_MARGIN;
  const maxX = workArea.x + workArea.width - BUBBLE_SCREEN_MARGIN - card.width;
  const minY = workArea.y + BUBBLE_SCREEN_MARGIN;
  const maxY =
    workArea.y + workArea.height - BUBBLE_SCREEN_MARGIN - card.height;
  const leftX = footprint.x + CARD_INSET_X - card.width;
  const rightX = footprint.x + AVATAR_FOOTPRINT - CARD_INSET_X;
  const side: AvatarBubbleSide =
    leftX < minX && rightX <= maxX ? 'right' : 'left';
  const x = side === 'left' ? leftX : rightX;
  const y = footprint.y + AVATAR_FOOTPRINT - CARD_BOTTOM_INSET - card.height;
  return {
    x: Math.max(minX, Math.min(x, maxX)),
    y: Math.max(minY, Math.min(y, maxY)),
    side,
  };
}

/** Tallest card that still fits the work area with its window padding. */
export function avatarBubbleMaxHeight(workArea: Area, padding: number) {
  return Math.max(160, workArea.height - 2 * (BUBBLE_SCREEN_MARGIN + padding));
}
