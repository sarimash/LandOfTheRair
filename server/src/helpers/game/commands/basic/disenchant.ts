
import { uniq } from 'lodash';

import { GameServerResponse, IDialogChatAction, IMacroCommandArgs,
  IPlayer, ItemSlot, SoundEffect, Tradeskill } from '../../../../interfaces';
import { MacroCommand } from '../../../../models/macro';

export class Disenchant extends MacroCommand {

  override aliases = ['disenchant'];
  override canBeInstant = false;
  override canBeFast = false;

  override execute(player: IPlayer, args: IMacroCommandArgs) {
    const item = player.items.equipment[ItemSlot.RightHand];

    if (item && args.stringArgs) {
      return this.sendMessage(player, 'You need to empty your right hand to mass disenchant!');
    }

    // no right hand = mass DE
    if (!item) {

      // send popup
      if (!args.stringArgs) {

        const options: string[] = uniq(player.items.sack.items
          .filter(x => this.game.itemHelper.getItemProperty(x, 'quality') >= 1)
          .map(x => this.game.itemHelper.getItemProperty(x, 'itemClass')))
          .sort();

        if (options.length === 0) return this.sendMessage(player, 'You do not have any disenchantable items in your sack!');

        const message = 'What would you like to disenchant all of (from your sack)?';

        const formattedChat: IDialogChatAction = {
          message,
          displayTitle: 'Mass Disenchant',
          options: [
            ...options.map(x => ({ text: x, action: `disenchant ${x}` })),
            { text: 'Nothing', action: 'noop' },
          ]
        };

        this.game.transmissionHelper.sendResponseToAccount(player.username, GameServerResponse.DialogChat, formattedChat);

        return;

      }

      // DE all items
      if (args.stringArgs) {
        const items = player.items.sack.items
          .filter(x => this.game.itemHelper.getItemProperty(x, 'itemClass') === args.stringArgs)
          .filter(x => this.game.itemHelper.getItemProperty(x, 'quality') >= 1)
          .filter(x => this.game.itemHelper.isOwnedBy(player, x));

        if (items.length === 0) return this.sendMessage(player, 'You do not have any matching disenchantable items in your sack!');

        const uuids = items.map(x => x.uuid);

        const enosDust = this.game.itemCreator.getSimpleItem('Enchanting Dust - Enos');
        enosDust.mods.ounces = 0;

        items.forEach(cItem => enosDust.mods.ounces += (this.game.itemHelper.getItemProperty(cItem, 'quality') ?? 0));

        this.game.characterHelper.setEquipmentSlot(player, ItemSlot.RightHand, enosDust);

        const skill = this.game.calculatorHelper.calcTradeskillLevelForCharacter(player, Tradeskill.Spellforging);
        if (skill < 10) {
          this.game.playerHelper.gainTradeskill(player, Tradeskill.Spellforging, enosDust.mods.ounces);
        }

        this.game.inventoryHelper.removeItemsFromSackByUUID(player, uuids);

        const message = `You disenchant the ${args.stringArgs.toLowerCase()} items in your sack and get ${enosDust.mods.ounces}oz dust!`;
        this.sendMessage(player, message, SoundEffect.CombatBlockArmor);

        return;
      }
    }

    // right hand = single DE (we check stringArgs in case a mistake happened)
    if (item && !args.stringArgs) {
      if (!this.game.itemHelper.isOwnedBy(player, item)) return this.sendMessage(player, 'That item is not yours to disenchant!');

      const quality = this.game.itemHelper.getItemProperty(item, 'quality') ?? 0;
      if (quality < 1) return this.sendMessage(player, 'That item has no magical powers!');

      const enosDust = this.game.itemCreator.getSimpleItem('Enchanting Dust - Enos');
      enosDust.mods.ounces = quality;

      this.game.characterHelper.setEquipmentSlot(player, ItemSlot.RightHand, enosDust);
      this.game.playerHelper.gainTradeskill(player, Tradeskill.Spellforging, quality);

      this.sendMessage(player, `You disenchant the item in your right hand and get ${quality}oz dust!`, SoundEffect.CombatBlockArmor);
    }
  }
}
