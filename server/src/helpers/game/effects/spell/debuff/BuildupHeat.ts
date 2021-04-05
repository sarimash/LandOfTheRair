
import { random } from 'lodash';

import { DamageArgs, DamageClass, ICharacter, IStatusEffect } from '../../../../../interfaces';
import { Effect } from '../../../../../models';

export class BuildupHeat extends Effect {

  override tick(char: ICharacter, effect: IStatusEffect) {
    super.tick(char, effect);

    if (effect.effectInfo.buildUpCurrent) {
      effect.effectInfo.buildUpCurrent -= (effect.effectInfo.buildUpDecay ?? 3);
      if (effect.effectInfo.buildUpCurrent <= 0) {
        this.game.effectHelper.removeEffect(char, effect);
      }
    }
  }

  public override incoming(
    effect: IStatusEffect,
    char: ICharacter,
    attacker: ICharacter | null,
    damageArgs: DamageArgs,
    currentDamage: number
  ): number {

    if (damageArgs.damageClass === DamageClass.Fire) {
      effect.effectInfo.potency ??= 0;
      effect.effectInfo.buildUpCurrent ??= 0;

      effect.effectInfo.potency += currentDamage;
      effect.effectInfo.buildUpCurrent += random(10, 25);

      if (effect.effectInfo.buildUpCurrent >= (effect.effectInfo.buildUpMax ?? 200)) {
        this.game.effectHelper.removeEffect(char, effect);
        this.game.effectHelper.addEffect(char, '', 'Burning', { effect: { extra: { potency: effect.effectInfo.potency } } });
      }
    }

    return currentDamage;
  }

}
