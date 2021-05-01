import { Parser } from 'muud';

import { Game } from '../../../../helpers';
import { IAIBehavior, INPC, IResetterBehavior } from '../../../../interfaces';

export class ResetterBehavior implements IAIBehavior {

  init(game: Game, npc: INPC, parser: Parser, behavior: IResetterBehavior) {

    parser.addCommand('hello')
      .setSyntax(['hello'])
      .setLogic(async ({ env }) => {
        const player = env?.player;
        if (!player) return 'You do not exist.';

        if (game.directionHelper.distFrom(player, npc) > 0) return 'Please come closer.';

        return 'Hello!';
      });
  }

  tick() {}
}
