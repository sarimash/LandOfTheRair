import { Component, OnDestroy, OnInit } from '@angular/core';
import { Select, Store } from '@ngxs/store';

import { AutoUnsubscribe } from 'ngx-auto-unsubscribe';
import { Observable } from 'rxjs';
import { first } from 'rxjs/operators';

import allMacros from '../../../../assets/content/_output/macros.json';

import { ICharacter, IMacro, IMacroBar, IPlayer } from '../../../../interfaces';
import { GameState, MacrosState, SetActiveMacro, SetActiveMacroBars, SetCurrentCommand } from '../../../../stores';

import { GameService } from '../../../services/game.service';
import { MacrosService } from '../../../services/macros.service';

@AutoUnsubscribe()
@Component({
  selector: 'app-macro-bar',
  templateUrl: './macro-bar.component.html',
  styleUrls: ['./macro-bar.component.scss']
})
export class MacroBarComponent implements OnInit, OnDestroy {

  @Select(GameState.player) player$: Observable<IPlayer>;
  @Select(MacrosService.currentPlayerMacros) macros$: Observable<any>;
  @Select(MacrosState.allMacros) allMacros$: Observable<any>;
  @Select(GameState.currentTarget) currentTarget$: Observable<ICharacter>;

  public readonly macroArray = Array(10).fill(null).map((x, i) => i);

  constructor(
    private store: Store,
    public gameService: GameService
  ) { }

  ngOnInit() {
  }

  ngOnDestroy() {}

  public operateOnMacro(player: IPlayer, macro: IMacro) {
    if (!macro || this.isMacroDisabled(player, macro)) return;

    if (macro.mode === 'lockActivation') {
      this.store.dispatch(new SetActiveMacro(macro.name));
      return;
    }

    if (macro.mode === 'autoActivate') {
      this.gameService.sendCommandString(macro.macro);
      return;
    }

    if (macro.mode === 'autoTarget') {
      this.currentTarget$.pipe(first()).subscribe(target => {
        if (target) {
          this.gameService.sendCommandString(macro.macro, target.uuid);
          return;
        }

        this.store.dispatch(new SetCurrentCommand(`#${macro.macro}`));
      });
      return;
    }

    this.store.dispatch(new SetCurrentCommand(`#${macro.macro}`));
  }

  public changeMacroGroup(macroBars: string[], allMacroBars: Record<string, IMacroBar>, macroBarIndex: number, modifier = 0) {
    const currentName = macroBars[macroBarIndex];

    const orderedMacroBars = Object.keys(allMacroBars).sort();
    const currentIndex: any = orderedMacroBars.findIndex(x => x === currentName);

    let newIndex = currentIndex + modifier;
    if (newIndex === -1) newIndex = orderedMacroBars.length - 1;
    if (newIndex === orderedMacroBars.length) newIndex = 0;

    const newMacroBars = [...macroBars];
    newMacroBars[macroBarIndex] = orderedMacroBars[newIndex];

    this.store.dispatch(new SetActiveMacroBars(newMacroBars));
  }

  public macroCooldown(player: IPlayer, macro: IMacro): number {
    if (!macro?.for) return 0;
    return player.spellCooldowns?.[macro.for] ?? 0;
  }

  public isMacroDisabled(player: IPlayer, macro: IMacro): boolean {
    if (!macro?.for) return false;

    // we make this check in case they have a spell scroll that references a spell that is a default macro
    if (allMacros[macro.for] && !player.learnedSpells[macro.for.toLowerCase()]) return true;

    if (allMacros[macro.for]) return false;
    return !player.learnedSpells[macro.for.toLowerCase()] || player.spellCooldowns?.[macro.for] > Date.now();
  }

}
