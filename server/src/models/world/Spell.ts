

import { DeepPartial, ICharacter, IItemEffect, ISpellData,
  IStatusEffectData, MessageInfo, MessageType } from '../../interfaces';

import { Game } from '../../helpers';
import { BaseSpell } from '../../interfaces/BaseSpell';

export class Spell implements BaseSpell {

  constructor(protected game: Game) {}

  public sendMessage(character: ICharacter|string, message: MessageInfo, messageTypes: MessageType[] = [MessageType.Miscellaneous]): void {
    this.game.messageHelper.sendLogMessageToPlayer(character, message, messageTypes);
  }

  public formatMessage(message: string, args: { target?: string; caster?: string }): string {
    return message
      .split('%target').join(args.target ?? 'somebody')
      .split('%caster').join(args.caster ?? 'somebody');
  }

  public cast(caster: ICharacter | null, target: ICharacter | null, override: Partial<IItemEffect>): void {}

  public getOverrideEffectInfo(
    caster: ICharacter | null, target: ICharacter | null, spellData: ISpellData, override: Partial<IItemEffect> = {}
  ): DeepPartial<IStatusEffectData> {
    return {
      effect: {
        duration: override.duration ?? this.getDuration(caster, target, spellData),
        extra: {
          charges: override.charges ?? this.getCharges(caster, target, spellData),
          potency: override.potency ?? this.getPotency(caster, target, spellData)
        }
      },
      tooltip: {
        desc: this.getUnformattedTooltipDesc(caster, target, spellData)
      }
    };
  }

  public getUnformattedTooltipDesc(caster: ICharacter | null, target: ICharacter | null, spellData: ISpellData): string {
    return '';
  }

  public getDuration(caster: ICharacter | null, target: ICharacter | null, spellData: ISpellData): number {
    return 0;
  }

  public getCharges(caster: ICharacter | null, target: ICharacter | null, spellData: ISpellData): number {
    return 0;
  }

  public getPotency(caster: ICharacter | null, target: ICharacter | null, spellData: ISpellData): number {
    return this.game.spellManager.getPotency(caster, target, spellData);
  }

}
