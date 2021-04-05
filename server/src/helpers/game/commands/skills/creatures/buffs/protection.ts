import { ICharacter } from '../../../../../../interfaces';
import { SpellCommand } from '../../../../../../models/macro';

export class Protection extends SpellCommand {

  override aliases = ['protection', 'cast protection'];
  override requiresLearn = true;
  override canTargetSelf = true;
  override spellRef = 'Protection';

  override canUse(caster: ICharacter, target: ICharacter): boolean {
    return super.canUse(caster, target) && !this.game.effectHelper.hasEffect(target, 'Protection');
  }

}
