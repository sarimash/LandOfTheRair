import { Injectable } from 'injection-js';
import { isArray, random, size } from 'lodash';
import uuid from 'uuid/v4';

import { Allegiance, BaseClass, BGM, Direction,
  Holiday,
  initializePlayer, IPlayer, ISuccorInfo, MessageType, Skill, Stat, Tradeskill } from '../../interfaces';
import { Account, Player } from '../../models';
import { BaseService } from '../../models/BaseService';
import { GetSwimLevel, StaticTextHelper, WorldManager } from '../data';
import { CharacterHelper } from './CharacterHelper';
import { TeleportHelper } from './TeleportHelper';
import { VisibilityHelper } from './VisibilityHelper';


@Injectable()
export class PlayerHelper extends BaseService {

  private mapXPMultiplier = {
    uncut: 1,
    firstSoftCut: 0.9,
    secondSoftCut: 0.75,
    hardCut: 0.5,
    unknown: 0.1
  };

  constructor(
    private characterHelper: CharacterHelper,
    private staticTextHelper: StaticTextHelper,
    private visibilityHelper: VisibilityHelper,
    private teleportHelper: TeleportHelper,
    private worldManager: WorldManager
  ) {
    super();
  }

  public init() {
    this.mapXPMultiplier = this.game.contentManager.getGameSetting('map', 'xpMultiplier') ?? {
      uncut: 1,
      firstSoftCut: 0.9,
      secondSoftCut: 0.75,
      hardCut: 0.5,
      unknown: 0.1
    };
  }

  public migrate(player: Player, playerAccount: Account): void {
    const basePlayer = initializePlayer({});
    Object.keys(basePlayer).forEach(key => {
      if (player[key]) return;
      player[key] = basePlayer[key];
    });

    if (!player.uuid) player.uuid = uuid();
    if (!player.dir) player.dir = Direction.South;
    if (!player.actionQueue) player.actionQueue = { fast: [], slow: [] };
    if (!player.effects.debuff) player.effects.debuff = [];
    if (!player.effects.buff) player.effects.buff = [];
    if (!player.effects.outgoing) player.effects.outgoing = [];
    if (!player.effects.incoming) player.effects.incoming = [];
    if (!player.learnedRecipes) player.learnedRecipes = [];
    if (!player.tradeskills) player.tradeskills = {};
    if (!player.stats.mp) player.stats.mp = 100;
    if (!player.stats.mpregen) player.stats.mpregen = 1;

    if ((player.mp as any).__current) {
      player.mp.current = (player.mp as any).__current;
      delete (player.mp as any).__current;
    }
    if ((player.hp as any).__current) {
      player.hp.current = (player.hp as any).__current;
      delete (player.hp as any).__current;
    }

    if (!player.traits.tp && size(player.traits.traitsLearned) === 0) {
      this.game.traitHelper.resetTraits(player);
    }

    if (player.learnedRunes.length > 0) {
      const remove: string[] = [];

      player.learnedRunes.forEach(rune => {
        const runeItem = this.game.itemHelper.getItemDefinition(rune);
        if (runeItem) return;

        remove.push(rune);
      });

      player.learnedRunes = player.learnedRunes.filter(x => !remove.includes(x));
    }

    player.agro = {};

    player.isGM = playerAccount.isGameMaster;
    player.isTester = playerAccount.isTester;
    player.username = playerAccount.username;
    player.subscriptionTier = this.game.subscriptionHelper.getSubscriptionTier(playerAccount);

    player.lastRegionDesc = '';
    player.lastTileDesc = '';

    if (!player.accountLockers.lockers) player.accountLockers.lockers = { Shared: { items: [] } };
    if (!player.accountLockers.pouch) player.accountLockers.pouch = { items: [] };
    if (!player.accountLockers.materials) player.accountLockers.materials = {};

    // add sated if nothing else exists
    if (!this.game.effectHelper.hasEffect(player, 'Sated')
    && !this.game.effectHelper.hasEffect(player, 'Nourished')
    && !this.game.effectHelper.hasEffect(player, 'Malnourished')) {
      this.game.effectHelper.addEffect(player, '', 'Sated', { effect: { duration: 21600 } });
    }

    this.cleanUpInvalidItems(player);

    this.reformatPlayerAfterLoad(player);

    this.game.questHelper.recalculateQuestKillsAndStatRewards(player);
  }

  private cleanUpInvalidItems(player: IPlayer): void {

    const isValidItem = (itemName) => this.game.contentManager.getItemDefinition(itemName);

    // clean invalid equipment
    Object.keys(player.items.equipment).forEach(slot => {
      const item = player.items.equipment[slot];

      if (!item) return;
      if (isValidItem(item.name)) return;

      player.items.equipment[slot] = undefined;
    });

    // clean invalid inventory
    const removeBeltUUIDs: string[] = [];
    player.items.belt.items.forEach(item => {
      if (isValidItem(item.name)) return;
      removeBeltUUIDs.push(item.uuid);
    });

    this.game.inventoryHelper.removeItemsFromBeltByUUID(player, removeBeltUUIDs);

    const removeSackUUIDS: string[] = [];
    player.items.sack.items.forEach(item => {
      if (isValidItem(item.name)) return;
      removeSackUUIDS.push(item.uuid);
    });

    this.game.inventoryHelper.removeItemsFromSackByUUID(player, removeSackUUIDS);

    const removePouchUUIDs: string[] = [];
    player.accountLockers.pouch.items.forEach(item => {
      if (isValidItem(item.name)) return;
      removePouchUUIDs.push(item.uuid);
    });

    this.game.inventoryHelper.removeItemsFromPouchByUUID(player, removePouchUUIDs);

    // lockers
    Object.values(player.accountLockers.lockers || {}).concat(Object.values(player.lockers.lockers || {}))
      .forEach(locker => {
        const removeUUIDs: string[] = [];
        locker.items.forEach(item => {
          if (isValidItem(item.name)) return;
          removeUUIDs.push(item.uuid);
        });

        this.game.inventoryHelper.removeItemsFromLockerByUUID(player, removeUUIDs, locker);
      });

  }

  public becomeClass(player: IPlayer, baseClass: BaseClass, recalculateAfterTrait = true) {
    const maxMP: Record<BaseClass, number> = this.game.contentManager.getGameSetting('character', 'creation.baseMP') ?? {
      [BaseClass.Healer]: 50,
      [BaseClass.Mage]: 70,
      [BaseClass.Warrior]: 100,
      [BaseClass.Thief]: 100,
      [BaseClass.Traveller]: 0
    };

    player.baseClass = baseClass;
    player.mp.maximum = maxMP[baseClass];
    player.stats.mp = maxMP[baseClass];

    player.mp.current = maxMP[baseClass];

    if (baseClass === BaseClass.Warrior) {
      player.mp.current = 0;
    }

    const learnTrait: Record<BaseClass, string> = this.game.contentManager.getGameSetting('character', 'creation.learnedTraits') ?? {
      [BaseClass.Healer]: 'Afflict',
      [BaseClass.Mage]: 'MagicMissile',
      [BaseClass.Warrior]: 'Cleave',
      [BaseClass.Thief]: 'ImprovedHide',
      [BaseClass.Traveller]: ''
    };

    if (learnTrait[player.baseClass]) {
      this.game.traitHelper.learnTrait(player, learnTrait[player.baseClass], recalculateAfterTrait);
    }

    if (baseClass === BaseClass.Healer) {
      player.skills[Skill.Restoration] = this.game.calculatorHelper.calculateSkillXPRequiredForLevel(1);
    }

    if (baseClass === BaseClass.Mage) {
      player.skills[Skill.Conjuration] = this.game.calculatorHelper.calculateSkillXPRequiredForLevel(1);
    }
  }

  public reformatPlayerBeforeSave(player: Player): void {

    // persist remaining ticks so on load we don't lose effect times
    Object.values(player.effects || {}).forEach(arr => {
      if (!isArray(arr)) return;

      arr.forEach(eff => {
        if (eff.endsAt === -1) return;
        eff._ticksLeft = Math.floor((eff.endsAt - Date.now()) / 1000);
      });
    });
  }

  public reformatPlayerAfterLoad(player: Player): void {

    // re-hydrate effect timers
    Object.values(player.effects || {}).forEach(arr => {
      if (!isArray(arr)) return;

      arr.forEach(eff => {
        if (!eff._ticksLeft) return;
        eff.endsAt = Date.now() + (eff._ticksLeft * 1000);
        delete eff._ticksLeft;
      });
    });
  }

  public tick(player: Player, type: 'fast'|'slow', tick: number): void {
    if (type === 'slow') {
      this.characterHelper.tick(player, tick);
      this.game.transmissionHelper.generateAndQueuePlayerPatches(player);

      if (player.skillTicks > 0) {
        player.skillTicks--;
        if (player.skillTicks <= 0 && player.flaggedSkills.length > 0) {
          this.game.playerHelper.flagSkill(player, []);
        }
      }
    }

    const canAct = this.game.characterHelper.canAct(player);

    if (!canAct && type === 'slow') {
      this.game.characterHelper.tryDance(player);
      return;
    }

    // do actions if we have any
    if (player.actionQueue && canAct) {
      const queue = player.actionQueue[type] || [];

      const actions = type === 'fast' ? 5 : (this.getStat(player as IPlayer, Stat.ActionSpeed) || 1);

      for (let i = 0; i < actions; i++) {
        const command = queue.shift();

        // if there isn't a command we can't do anything
        if (!command) continue;

        // check if we can actually cast this
        const args = (command as any).args;

        this.game.crashContext.logContextEntry(player, `${player.username}#${player.name}: ${args.calledAlias} ${args.stringArgs}`);

        //  if we have a spell, we gotta do a lot of checks
        if (args.spell) {
          const [prefix, spell] = args.spell.split(' ');
          let hasLearned = this.game.characterHelper.hasLearned(player, spell || prefix);
          if (!hasLearned && (prefix === 'stance' || prefix === 'powerword' || prefix === 'findfamiliar' || prefix === 'song')) {
            hasLearned = this.game.characterHelper.hasLearned(player, `${prefix}${spell}`);
          }

          // if we have to bail because we dont know the spell, we let them know
          if (!hasLearned) {
            this.game.messageHelper.sendSimpleMessage(player, 'You do not know that ability!');
            continue;

          // otherwise, we know it, but we'll try to abuse an item for it
          } else {
            if (this.game.characterHelper.hasLearnedFromItem(player, spell)) {
              args.overrideEffect = this.game.characterHelper.abuseItemsForLearnedSkillAndGetEffect(player, spell);
            }
          }
        }

        // finally, we do the command
        command();
      }
    }

    // if we're on a dense tile, "respawn"
    const map = this.worldManager.getMap(player.map)?.map;
    if (!this.game.effectHelper.hasEffect(player, 'WallWalk')
    && (map?.getWallAt(player.x, player.y) || map?.getDenseDecorAt(player.x, player.y))) {
      this.game.messageHelper.sendSimpleMessage(player,
        `Whoops. Tell a GM "invalid loc" happened at ${player.x}, ${player.y} on ${player.map}.`
      );

      this.teleportHelper.teleportToRespawnPoint(player);
    }

    // bop players who aren't subscribers out of subscriber maps
    if (map?.subscriberOnly && !player.subscriptionTier) {
      this.game.messageHelper.sendSimpleMessage(player,
        'This location is subscriber only, you\'ll have to come back later!'
      );

      this.resetSpawnPointToDefault(player);
      this.teleportHelper.teleportToRespawnPoint(player);
    }

    if (map?.holiday && !this.game.holidayHelper.isHoliday(map.holiday as Holiday) && !player.isGM) {
      this.game.messageHelper.sendSimpleMessage(player,
        'This location is not active during this time of year!'
      );

      this.teleportHelper.teleportToRespawnPoint(player);
    }
  }

  public clearActionQueue(player: Player, target?: string) {

    // if we specify a target, we remove them from the queue as convenience
    if (player && player.actionQueue && target) {
      player.actionQueue.fast = player.actionQueue.fast.filter(x => !(x as any).args.stringArgs.includes(target));
      player.actionQueue.slow = player.actionQueue.slow.filter(x => !(x as any).args.stringArgs.includes(target));
      return;
    }

    // otherwise, just reset the entire queue
    player.actionQueue = { fast: [], slow: [] };
  }

  // reset swim level, fov, region desc
  public resetStatus(player: Player, opts: { ignoreMessages?: boolean; sendFOV?: boolean } = { sendFOV: true }) {

    this.visibilityHelper.calculatePlayerFOV(player, opts.sendFOV);

    const map = this.worldManager.getMap(player.map)?.map;
    if (!map) return;

    const z = map.getZLevelAt(player.x, player.y);
    player.z = z;

    const swimTile = map.getFluidAt(player.x, player.y);
    const swimInfo = GetSwimLevel(swimTile);

    if (swimInfo) {
      const { element, swimLevel } = swimInfo;
      player.swimElement = element;
      player.swimLevel = swimLevel;

      if (!this.game.effectHelper.hasEffect(player, 'Swimming')
      && !this.game.effectHelper.hasEffect(player, 'Drowning')) {
        const swimDuration = this.game.characterHelper.getStat(player, Stat.STR);
        this.game.effectHelper.addEffect(player, '', 'Swimming', { effect: { duration: swimDuration } });
      }

    } else {
      player.swimElement = '';
      player.swimLevel = 0;

      this.game.effectHelper.removeEffectByName(player, 'Swimming');
      this.game.effectHelper.removeEffectByName(player, 'Drowning');
    }

    // update the players BGM
    const newBGM = map.getBackgroundMusicAt(player.x, player.y);
    const oldBGM = player.bgmSetting;

    if (oldBGM !== newBGM) {
      player.bgmSetting = (newBGM || 'wilderness') as BGM;
    }

    // send message updates while the player is walking around the world
    if (!opts.ignoreMessages) {

      const regionDesc = map.getRegionDescriptionAt(player.x, player.y);

      let desc = '';

      const descObj = map.getInteractableAt(player.x, player.y) || map.getDecorAt(player.x, player.y);
      desc = this.staticTextHelper.getGidDescription(descObj?.gid);

      // we do this to avoid unnecessary lookups
      if (!desc) {
        desc = this.staticTextHelper.getGidDescription(map.getFluidAt(player.x, player.y));
      }

      if (!desc) {
        desc = map.getFoliageAt(player.x, player.y) ? 'You are near some trees.' : '';
      }

      if (!desc) {
        desc = this.staticTextHelper.getGidDescription(map.getFloorAt(player.x, player.y));
      }

      if (!desc) {
        desc = this.staticTextHelper.getGidDescription(map.getTerrainAt(player.x, player.y));
      }

      // send a new region desc if possible
      const hasNewRegion = regionDesc && regionDesc !== player.lastRegionDesc;
      if (hasNewRegion) {
        player.lastRegionDesc = regionDesc;
        this.game.messageHelper.sendLogMessageToPlayer(player, { message: regionDesc }, [MessageType.Environment]);

      } else if (!regionDesc) {
        player.lastRegionDesc = '';
      }

      // send a new tile desc if possible
      if (!hasNewRegion && desc && desc !== player.lastTileDesc) {
        player.lastTileDesc = desc;
        this.game.messageHelper.sendLogMessageToPlayer(player, { message: desc }, [MessageType.Environment]);
      }
    }
  }

  // get a stat from a player, or 0
  public getStat(player: IPlayer, stat: Stat): number {
    return player.stats[stat] || 0;
  }

  // flag a certain skill for a player
  public flagSkill(player: IPlayer, skill: Skill|Skill[]): void {
    player.flaggedSkills = Array.isArray(skill) ? skill : [skill];

    if (skill.length !== 0) {
      player.skillTicks = this.game.contentManager.getGameSetting('character', 'skillActiveTicks') ?? 30;
    }
  }

  // flag a certain skill for a player
  public trainSkill(player: IPlayer, skill: Skill, amt: number): void {
    player.paidSkills[skill] = player.paidSkills[skill] || 0;

    const baseVal = player.paidSkills[skill] ?? 0;
    player.paidSkills[skill] = baseVal + amt;

    if (isNaN(baseVal + amt)) player.paidSkills[skill] = amt;
  }

  // whether or not the player can get skill on the current map
  public canGainSkillOnMap(player: IPlayer, skill: Skill): boolean {
    const map = this.worldManager.getMap(player.map)?.map;
    if (!map) return false;

    return (player.skills[skill.toLowerCase()] ?? 0) < map.maxSkillExp;
  }

  // whether or not the player can get xp on the current map
  public canGainExpOnMap(player: IPlayer): boolean {
    const map = this.worldManager.getMap(player.map)?.map;
    if (!map) return false;

    return player.exp < map.maxLevelExp;
  }

  public expMultiplierForMap(player: IPlayer): number {
    const map = this.worldManager.getMap(player.map)?.map;
    if (!map) return this.mapXPMultiplier.unknown;

    if (player.exp < map.firstCutExp) return this.mapXPMultiplier.uncut;
    if (player.exp < map.secondCutExp) return this.mapXPMultiplier.firstSoftCut;
    if (player.exp < map.maxLevelExp) return this.mapXPMultiplier.secondSoftCut;

    return this.mapXPMultiplier.hardCut;
  }

  // lose exp (eat, suck)
  public loseExp(player: IPlayer, xpLost: number): void {
    this.gainExp(player, -xpLost);
  }

  // gain exp for a player
  public gainExp(player: IPlayer, xpGained: number): void {
    if (player.gainingAXP && xpGained > 0) return;

    if (xpGained > 0) {
      const xpGainBoostPercent = this.game.characterHelper.getStat(player, Stat.XPBonusPercent)
                               + this.game.dynamicEventHelper.getStat(Stat.XPBonusPercent);
      xpGained += Math.floor((xpGainBoostPercent * xpGained) / 100);
      xpGained = this.game.subscriptionHelper.xpGained(player, xpGained);
      xpGained = this.game.userInputHelper.cleanNumber(xpGained, 0, { floor: true });
    }

    player.exp = Math.max(Math.floor(player.exp + xpGained), 1);
    player.exp = Math.min(player.exp, this.game.configManager.MAX_EXP);

  }

  // gain axp for a player
  public gainAxp(player: IPlayer, axpGained: number): void {
    if (!player.gainingAXP && axpGained > 0) return;

    axpGained = this.game.subscriptionHelper.axpGained(player, axpGained);
    axpGained = this.game.userInputHelper.cleanNumber(axpGained, 0, { floor: true });
    player.axp = Math.max(Math.floor(player.axp + axpGained), 0);

  }

  // try to gain skill based on the current map etc
  public tryGainSkill(player: IPlayer, skill: Skill, skillGained: number): void {
    if (!this.canGainSkillOnMap(player, skill)) {
      this.gainSkill(player, skill, 1);
      return;
    }

    this.gainSkill(player, skill, skillGained);
  }

  // lose some skill (eat, suck)
  public loseSkill(player: IPlayer, skill: Skill, skillLost: number): void {
    this.gainSkill(player, skill, -skillLost);
  }

  // gain skill for a character
  public gainSkill(player: IPlayer, skill: Skill, skillGained: number): void {
    if (!skill) skill = Skill.Martial;

    const skillGainBoostPercent = this.game.characterHelper.getStat(player, Stat.SkillBonusPercent)
                                + this.game.dynamicEventHelper.getStat(Stat.SkillBonusPercent);
    skillGained += Math.floor((skillGainBoostPercent * skillGained) / 100);

    // paid skill is doubled as long as we have money in it
    const paidVal = player.paidSkills?.[skill] ?? 0;
    if (paidVal > 0) {
      player.paidSkills[skill] = paidVal - skillGained;
      skillGained *= 2;
    }

    skillGained = this.game.subscriptionHelper.skillGained(player, skillGained);
    skillGained = this.game.userInputHelper.cleanNumber(skillGained, 0);

    player.skills[skill.toLowerCase()] = Math.max((player.skills[skill.toLowerCase()] ?? 0) + skillGained, 0);
    player.skills[skill.toLowerCase()] = Math.min(player.skills[skill.toLowerCase()], this.game.configManager.MAX_SKILL_EXP);
  }

  // gain tradeskill skill for a character
  public gainTradeskill(player: IPlayer, skill: Tradeskill, skillGained: number): void {
    if (!skill) return;

    skillGained = this.game.userInputHelper.cleanNumber(skillGained, 0);

    player.tradeskills[skill.toLowerCase()] = Math.max((player.tradeskills[skill.toLowerCase()] ?? 0) + skillGained, 0);
  }

  // gain all currently flagged skills
  public gainCurrentSkills(player: IPlayer, skillGained: number): void {
    if (!player.flaggedSkills || !player.flaggedSkills.length) return;

    const [primary, secondary, tertiary, quaternary] = player.flaggedSkills;

    if (quaternary) {
      const skillgain = this.game.contentManager.getGameSetting('skillgain', 'four') ?? [];
      this.tryGainSkill(player, primary, skillGained * (skillgain[0] ?? 0.45));
      this.tryGainSkill(player, secondary, skillGained * (skillgain[1] ?? 0.25));
      this.tryGainSkill(player, tertiary, skillGained * (skillgain[2] ?? 0.15));
      this.tryGainSkill(player, quaternary, skillGained * (skillgain[3] ?? 0.15));

    } else if (tertiary) {
      const skillgain = this.game.contentManager.getGameSetting('skillgain', 'three') ?? [];
      this.tryGainSkill(player, primary, skillGained * (skillgain[0] ?? 0.55));
      this.tryGainSkill(player, secondary, skillGained * (skillgain[1] ?? 0.25));
      this.tryGainSkill(player, tertiary, skillGained * (skillgain[2] ?? 0.20));

    } else if (secondary) {
      const skillgain = this.game.contentManager.getGameSetting('skillgain', 'two') ?? [];
      this.tryGainSkill(player, primary, skillGained * (skillgain[0] ?? 0.75));
      this.tryGainSkill(player, secondary, skillGained * (skillgain[1] ?? 0.25));

    } else {
      const skillgain = this.game.contentManager.getGameSetting('skillgain', 'one') ?? [];
      this.tryGainSkill(player, primary, skillGained * (skillgain[0] ?? 1));
    }
  }

  // modify rep for a faction
  public modifyReputationForAllegiance(player: IPlayer, allegiance: Allegiance, mod: number): void {

    // event that can double rep gain
    if (this.game.dynamicEventHelper.isEventActive('Friendship Festival')) mod *= 2;

    player.allegianceReputation[allegiance] = player.allegianceReputation[allegiance] ?? 0;
    player.allegianceReputation[allegiance]! += mod;
  }

  // gain stats for leveling up
  public gainLevelStats(player: IPlayer): void {

    const con = this.game.characterHelper.getStat(player, Stat.CON);
    const wis = this.game.characterHelper.getStat(player, Stat.WIS);
    const int = this.game.characterHelper.getStat(player, Stat.INT);

    const classStats: Record<BaseClass, () => void> = {
      [BaseClass.Traveller]: () => {
        const {
          base, randomConDivisor, bonusConDivisor, randomConBonusMultiplier
        } = this.game.contentManager.getGameSetting('character', 'levelup.Traveller.hp');

        const hpGained = Math.floor(
          random(
            base ?? 2,
            (randomConBonusMultiplier ?? 1) * con / (randomConDivisor ?? 2)
          ) + con / (bonusConDivisor ?? 2)
        );
        this.game.characterHelper.gainPermanentStat(player, Stat.HP, hpGained);
      },

      [BaseClass.Warrior]: () => {
        const {
          base, randomConDivisor, bonusConDivisor, randomConBonusMultiplier
        } = this.game.contentManager.getGameSetting('character', 'levelup.Warrior.hp');

        const hpGained = Math.floor(
          random(
            base ?? 1,
            (randomConBonusMultiplier ?? 1) * con / (randomConDivisor ?? 2)
          ) + con / (bonusConDivisor ?? 2)
        );

        this.game.characterHelper.gainPermanentStat(player, Stat.HP, hpGained);
      },

      [BaseClass.Thief]: () => {
        const {
          base, randomConDivisor, bonusConDivisor, randomConBonusMultiplier
        } = this.game.contentManager.getGameSetting('character', 'levelup.Thief.hp');

        const hpGained = Math.floor(
          random(
            base ?? 2,
            (randomConBonusMultiplier ?? 1) * con / (randomConDivisor ?? 1)
          ) + con / (bonusConDivisor ?? 2)
        );

        this.game.characterHelper.gainPermanentStat(player, Stat.HP, hpGained);
      },

      [BaseClass.Healer]: () => {
        const {
          base, randomConDivisor, bonusConDivisor, randomConBonusMultiplier
        } = this.game.contentManager.getGameSetting('character', 'levelup.Healer.hp');

        const hpGained = Math.floor(
          random(
            base ?? 3,
            (randomConBonusMultiplier ?? 3) * con / (randomConDivisor ?? 5)
          ) + con / (bonusConDivisor ?? 3)
        );

        this.game.characterHelper.gainPermanentStat(player, Stat.HP, hpGained);

        const {
          base: baseMP, randomMultiplier, randomDivisor
        } = this.game.contentManager.getGameSetting('character', 'levelup.Healer.mp');

        const mpGained = Math.floor(random(baseMP ?? 1, wis * (randomMultiplier ?? 1)) + wis / (randomDivisor ?? 3));
        this.game.characterHelper.gainPermanentStat(player, Stat.MP, mpGained);
      },

      [BaseClass.Mage]: () => {
        const {
          base, randomConDivisor, bonusConDivisor, randomConBonusMultiplier
        } = this.game.contentManager.getGameSetting('character', 'levelup.Mage.hp');

        const hpGained = Math.floor(
          random(
            base ?? 1,
            (randomConBonusMultiplier ?? 1) * con / (randomConDivisor ?? 1)
          ) + con / (bonusConDivisor ?? 1)
        );

        this.game.characterHelper.gainPermanentStat(player, Stat.HP, hpGained);

        const {
          base: baseMP, randomMultiplier, randomDivisor
        } = this.game.contentManager.getGameSetting('character', 'levelup.Healer.mp');

        const mpGained = Math.floor(random(baseMP ?? 2, int * (randomMultiplier ?? 2)) + int / (randomDivisor ?? 5));
        this.game.characterHelper.gainPermanentStat(player, Stat.MP, mpGained);
      }
    };

    classStats[player.baseClass]();

    this.game.characterHelper.recalculateEverything(player);
  }

  // try to level up a player to the maximum possible level they can go based on the trainer they see
  public tryLevelUp(player: IPlayer, maxLevel = 0): void {
    do {
      if (player.level >= maxLevel) break;

      const neededXp = this.game.calculatorHelper.calculateXPRequiredForLevel(player.level + 1);
      if (player.exp >= neededXp) {
        player.level += 1;
        if (player.level > player.highestLevel) {
          player.highestLevel = player.level;
          player.traits.tp += 1;
          this.gainLevelStats(player);
        }
        break;
      } else {
        break;
      }
    } while (player.level < maxLevel);
  }

  public tryAncientLevelUp(player: IPlayer): void {
    const maxPerLevel = this.game.contentManager.getGameSetting('character', 'axpPerLevel') ?? 500;

    while (player.axp > maxPerLevel) {
      player.axp -= maxPerLevel;
      player.ancientLevel += 1;
      player.traits.ap += 1;
    }
  }

  // teleport the player to the succor location
  public doSuccor(player: IPlayer, succorInfo: ISuccorInfo) {
    if (this.game.characterHelper.isDead(player)) return;

    const map = this.worldManager.getMap(player.map)?.map;
    if (!map) return;

    if (!map.canSuccor(player)) {
      this.game.messageHelper.sendSimpleMessage(player, 'The blob turns to ash in your hand!');
      return;
    }

    if (!succorInfo.map || !succorInfo.x || !succorInfo.y) {
      this.game.messageHelper.sendSimpleMessage(player, 'Your succor is not valid.');
      this.game.logger.log('PlayerHelper:DoSuccor', `Bad Succor: ${JSON.stringify(succorInfo)}`);
      return;
    }

    this.game.messageHelper.sendSimpleMessage(player, 'You are whisked back to the place in your stored memories!');
    this.game.teleportHelper.teleport(player as Player, succorInfo);
    this.game.transmissionHelper.sendMovementPatch(player as Player);
  }

  // refresh the players state based on their map, shortcut
  public refreshPlayerMapState(player: Player): void {
    const state = this.game.worldManager.getMap(player.map)?.state;
    if (!state) return;

    state.triggerFullUpdateForPlayer(player as Player);
  }

  // reset the players respawn to the default
  public resetSpawnPointToDefault(player: Player): void {
    player.respawnPoint = this.game.contentManager.getGameSetting('map', 'defaultRespawnPoint') ?? {
      map: 'Rylt',
      x: 68,
      y: 13
    };
  }

}
