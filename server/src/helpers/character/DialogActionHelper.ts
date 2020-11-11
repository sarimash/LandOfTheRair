import { Injectable } from 'injection-js';
import { template } from 'lodash';

import { BaseService, GameServerResponse, IDialogAction, IDialogActionType,
  IDialogChatAction, IDialogChatActionOption, IDialogCheckItemAction,
  IDialogGiveEffectAction,
  IDialogGiveItemAction, IDialogRequirement, IDialogTakeItemAction, INPC,
  IPlayer, ItemSlot, MessageType, Stat } from '../../interfaces';

interface IActionResult {
  messages: string[];
  shouldContinue: boolean;
}

@Injectable()
export class DialogActionHelper extends BaseService {

  public init() {}

  public async handleDialog(player: IPlayer, npc: INPC, command: string): Promise<void> {
    const messages = await (npc as any).dialogParser.parse(command, { player });
    (messages || []).forEach(message => {
      this.game.messageHelper.sendLogMessageToPlayer(player, { message, from: npc.name }, [MessageType.NPCChatter]);
    });
  }

  public handleAction(action: IDialogAction, npc: INPC, player: IPlayer): IActionResult {

    const actions: Record<IDialogActionType, (act, npc, player) => IActionResult> = {
      [IDialogActionType.Chat]:         this.handleChatAction,
      [IDialogActionType.CheckItem]:    this.handleCheckItemAction,
      [IDialogActionType.TakeItem]:     this.handleTakeItemAction,
      [IDialogActionType.GiveItem]:     this.handleGiveItemAction,
      [IDialogActionType.GiveEffect]:   this.handleGiveEffectAction
    };

    return actions[action.type].bind(this)(action, npc, player);
  }

  private handleChatAction(action: IDialogChatAction, npc: INPC, player: IPlayer): IActionResult {

    const maxDistance = action.maxDistance ?? 3;
    if (this.game.directionHelper.distFrom(player, npc) > maxDistance) {
      return { messages: ['Please come closer.'], shouldContinue: false };
    }

    const formattedChat: IDialogChatAction = {
      message: template(action.message)(player),
      displayNPCName: npc.name,
      displayNPCSprite: npc.sprite,
      displayNPCUUID: npc.uuid,
      options: action.options
        .map(x => {
          if (x.requirement && !this.meetsRequirement(player, x.requirement)) return null;
          return {
            text: template(x.text)(player),
            action: x.action
          };
        })
        .filter(Boolean) as IDialogChatActionOption[]
    };

    this.game.messageHelper.sendLogMessageToPlayer(player, { message: formattedChat.message, from: npc.name }, [MessageType.NPCChatter]);
    this.game.transmissionHelper.sendResponseToAccount(player.username, GameServerResponse.DialogChat, formattedChat);

    return { messages: [], shouldContinue: true };
  }

  private handleCheckItemAction(action: IDialogCheckItemAction, npc: INPC, player: IPlayer): IActionResult {
    const { slot, item, checkPassActions, checkFailActions } = action;

    const retMessages: string[] = [];

    let didSucceed = false;

    (slot || []).forEach(checkSlot => {
      const slotItem = player.items.equipment[checkSlot];
      if (!slotItem) return;

      const { name, owner } = item;
      if (slotItem.name !== name) return;
      if (owner && slotItem.mods.owner !== player.username) {
        retMessages.push('Hey! You need to bring me an item owned by you.');
        return;
      }

      didSucceed = true;
    });

    const actions = didSucceed ? checkPassActions : checkFailActions;

    for (const subAction of actions) {
      const { messages, shouldContinue } = this.handleAction(subAction, npc, player);
      retMessages.push(...messages);

      if (!shouldContinue) return { messages: retMessages, shouldContinue: false };
    }

    return { messages: retMessages, shouldContinue: true };
  }

  private handleTakeItemAction(action: IDialogTakeItemAction, npc: INPC, player: IPlayer): IActionResult {
    const { slot, item } = action;

    let didSucceed = false;

    (slot || []).forEach(checkSlot => {
      const slotItem = player.items.equipment[checkSlot];
      if (!slotItem) return;

      const { name, owner } = item;
      if (slotItem.name !== name) return;
      if (owner && slotItem.mods.owner !== player.username) return;

      this.game.characterHelper.setEquipmentSlot(player, checkSlot as ItemSlot, undefined);

      didSucceed = true;
    });

    const messages: string[] = [];
    if (!didSucceed) messages.push('Hey! You need to bring me an item owned by you.');

    return { messages, shouldContinue: didSucceed };
  }

  private handleGiveItemAction(action: IDialogGiveItemAction, npc: INPC, player: IPlayer): IActionResult {
    const { slot, item } = action;

    let didSucceed = false;

    (slot || []).forEach(checkSlot => {
      const slotItem = player.items.equipment[checkSlot];
      if (slotItem) return;

      const simpleItem = this.game.itemCreator.getSimpleItem(item.name);
      this.game.characterHelper.setEquipmentSlot(player, checkSlot as ItemSlot, simpleItem);

      didSucceed = true;
    });

    return { messages: [], shouldContinue: didSucceed };
  }

  private handleGiveEffectAction(action: IDialogGiveEffectAction, npc: INPC, player: IPlayer): IActionResult {

    const { effect, duration } = action;

    this.game.effectHelper.addEffect(player, npc, effect, {}, duration);

    return { messages: [], shouldContinue: true };
  }

  private meetsRequirement(player: IPlayer, requirement: IDialogRequirement): boolean {
    if (requirement.stat && requirement.statValue) {
      const stat = this.game.characterHelper.getStat(player, requirement.stat as Stat);
      if (stat < requirement.statValue) return false;
    }

    return true;
  }
}
