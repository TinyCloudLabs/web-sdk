// 🔥 NEOBRUTALISM COMPONENT LIBRARY - COMPLETE EXPORT INDEX
// This file completely replaces the need for existing component imports

import { NeoBrutalButton } from './Button';
import { NeoBrutalCard } from './Card';
import { NeoBrutalInput } from './Input';

// Button Components
export {
  NeoBrutalButton,
  NeoButton,
  NeoButtonPrimary,
  NeoButtonSecondary,
  NeoButtonNeutral,
  NeoButtonOutline,
  NeoButtonGhost,
  NeoButtonSuccess,
  NeoButtonWarning,
  NeoButtonInfo,
  NeoButtonDanger,
  NeoButtonBouncy,
  NeoButtonShaky,
  NeoButtonSpinny,
  NeoButtonGlowy,
  default as Button
} from './Button';

// Card Components
export {
  NeoBrutalCard,
  NeoCard,
  NeoCardDefault,
  NeoCardAccent,
  NeoCardSuccess,
  NeoCardWarning,
  NeoCardInfo,
  NeoCardDanger,
  NeoCardGhost,
  NeoCardFloating,
  NeoCardTilted,
  NeoCardGlowing,
  NeoCardGradient,
  NeoCardFloaty,
  NeoCardShaky,
  NeoCardHeader,
  NeoCardTitle,
  NeoCardContent,
  NeoCardFooter,
  default as Card
} from './Card';

// Input Components
export {
  NeoBrutalInput,
  NeoInput,
  NeoInputDefault,
  NeoInputAccent,
  NeoInputSuccess,
  NeoInputWarning,
  NeoInputInfo,
  NeoInputDanger,
  NeoInputGhost,
  NeoInputBrutal,
  NeoInputGlowing,
  NeoInputBouncy,
  NeoInputShaky,
  NeoInputGroup,
  NeoInputLabel,
  NeoInputHelperText,
  NeoTextarea,
  default as Input
} from './Input';

// Type Exports
export type { NeoBrutalButtonProps } from './Button';
export type { NeoBrutalCardProps } from './Card';
export type { NeoBrutalInputProps } from './Input';

// 🎨 CONVENIENT ALIASES FOR COMMON COMPONENTS
export { NeoBrutalButton as Btn } from './Button';

// 🔥 DEFAULT EXPORTS FOR AGGRESSIVE REPLACEMENT
const NeoComponents = {
  Button: NeoBrutalButton,
  Card: NeoBrutalCard,
  Input: NeoBrutalInput,
};

export default NeoComponents;