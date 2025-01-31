import { Component, OnDestroy, OnInit } from '@angular/core';
import { Select, Store } from '@ngxs/store';
import { clamp } from 'lodash';

import { AutoUnsubscribe } from 'ngx-auto-unsubscribe';
import { Observable, Subscription } from 'rxjs';
import { IAccount, IPlayer, IStatusEffect, SilverPurchase } from '../../../../interfaces';
import { AccountState, GameState, ToggleWindow } from '../../../../stores';

import { GameService } from '../../../services/game.service';

import { calculateXPRequiredForLevel } from '../../../../interfaces';
import { UIService } from '../../../services/ui.service';

@AutoUnsubscribe()
@Component({
  selector: 'app-player-status',
  templateUrl: './player-status.component.html',
  styleUrls: ['./player-status.component.scss']
})
export class PlayerStatusComponent implements OnInit, OnDestroy {

  @Select(AccountState.account) account$: Observable<IAccount>;
  @Select(GameState.player) player$: Observable<IPlayer>;
  public account: IAccount;
  public player: IPlayer;
  public effects: IStatusEffect[] = [];
  public showPouch: boolean;

  playerSub: Subscription;
  accountSub: Subscription;

  constructor(
    private store: Store,
    public uiService: UIService,
    public gameService: GameService
  ) { }

  ngOnInit() {
    this.playerSub = this.player$.subscribe(p => this.setPlayer(p));
    this.accountSub = this.account$.subscribe(a => this.setAccount(a));
  }

  ngOnDestroy() {}

  private setPlayer(p: IPlayer) {
    this.player = p;
    this.effects = this.getEffects(p);
  }

  private setAccount(a: IAccount) {
    this.account = a;
    this.showPouch = !!a.premium.silverPurchases?.[SilverPurchase.MagicPouch];
  }

  trackEffectBy(effect: IStatusEffect) {
    return effect.uuid;
  }

  getEffects(player: IPlayer): IStatusEffect[] {
    if (!player) return [];

    const base = [
      ...player.effects.buff,
      ...player.effects.debuff,
      ...player.effects.incoming,
      ...player.effects.outgoing
    ].filter(x => !x.effectInfo.hidden);

    if (player.spellChannel) {
      base.unshift({
        uuid: 'channel',
        effectName: 'Channeling',
        sourceName: '',
        endsAt: Date.now() + (player.spellChannel.ticks * 1000),
        effectInfo: { potency: 1 }
      });
    }

    return base;
  }

  xpString(player: IPlayer): string {
    return `${player.exp.toLocaleString()} / ${this.levelXP(player.level + 1).toLocaleString()}`;
  }

  levelXP(level: number): number {
    return calculateXPRequiredForLevel(level);
  }

  xpPercent(player: IPlayer): string {
    const playerXP = player.exp;
    const curPlayerLevelXP = this.levelXP(player.level);
    const nextPlayerLevelXP = this.levelXP(player.level + 1);

    return clamp((playerXP - curPlayerLevelXP) / (nextPlayerLevelXP - curPlayerLevelXP) * 100, 0, 100).toFixed(2);
  }

  axpPercent(player: IPlayer): string {
    const playerXP = player.axp;

    return Math.min(100, (playerXP / 500) * 100).toFixed(2);
  }

  unapply($event, effect: IStatusEffect): void {
    $event.stopPropagation();
    $event.preventDefault();

    // songs are a bit complicated 🤦‍♀️
    if (effect.effectInfo.unique === 'Song') {
      this.gameService.sendCommandString(`!removesong ${effect.uuid}`);
    } else {
      this.gameService.sendCommandString(`!removeeffect ${effect.uuid}`);
    }
  }

  showWindow(window: string): void {
    this.store.dispatch(new ToggleWindow(window));
  }

}
