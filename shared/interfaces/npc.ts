import { IAIBehavior, IBehavior } from './behaviors';
import { Alignment, Allegiance, BaseClass, Hostility, ItemSlot,
  MonsterClass, RandomNumber, Rollable, Skill, SkillBlock, Stat, StatBlock } from './building-blocks';
import { BoundedNumber, ICharacter } from './character';
import { ICharacterItems } from './characteritems';
import { IDialogTree } from './dialog';
import { IStatusEffectInfo } from './status-effect';

export enum NPCTriggerType {
  Spawn = 'spawn',
  Leash = 'leash',
  Combat = 'combat'
}

export interface INPCDefinition {
  npcId: string;

  // the sprite or sprites this creature can be
  sprite: number | number[];

  // the npc name - optional - if unspecified, generated randomly
  name?: string[];

  // the npc "guild" that it belongs to
  affiliation?: string;

  // the alignment of this npc
  alignment?: Alignment;

  // the allegiance of the npc - determines basic reps
  allegiance?: Allegiance;

  // the current reputation (how it views other allegiances)
  allegianceReputation?: Partial<Record<Allegiance, number>>;

  // whether the npc can only use water
  aquaticOnly?: boolean;

  // whether the npc will avoid stepping in water
  avoidWater?: boolean;

  // the base class of the creature
  baseClass?: BaseClass;

  // the base effects given to the creature (usually attributes/truesight/etc)
  baseEffects?: Array<{ name: string; endsAt: number; extra: IStatusEffectInfo }>;

  // the behaviors for the npc
  behaviors?: IBehavior[];

  // the drop chance for copying items that are already equipped
  copyDrops?: Rollable[];

  // the dialog tree for the npc, if applicable
  dialog?: IDialogTree;

  // the drop pool for lairs that can drop X of Y items
  dropPool?: {
    replace?: boolean;
    choose: {
      min: number;
      max: number;
    };
    items: Rollable[];
  };

  // stuff that can be put in the loot table for normal drops
  drops?: Rollable[];

  // the hp multiplier for the npc
  hpMult?: number;

  // extra properties pulled in from the map, varies depending on the NPC
  extraProps?: any;

  // the AI to force on this creature
  forceAI?: string;

  // gear items that can spawn on the creature
  items?: {
    equipment?: Partial<Record<ItemSlot, Rollable[]>>;
    sack?: Rollable[];
    belt?: Rollable[];
  };

  // the creatures level
  level: number;

  // how far the NPC can wander, in tiles
  maxWanderRandomlyDistance?: number;

  // the creature class (used for rippers, etc)
  monsterClass?: MonsterClass;

  // the monster grouping, so Hostility.Always dont infight with themselves
  monsterGroup?: string;

  // the owner of the creature (used for summons)
  owner?: string;

  // the "other stats" for this npc, inherited from NPC definition
  otherStats?: Partial<Record<Stat, number>>;

  // how hostile the creature is (default: always)
  hostility?: Hostility;

  // the base hp/mp/gold/xp for the creature
  hp: RandomNumber;
  mp: RandomNumber;
  gold: RandomNumber;
  giveXp: RandomNumber;

  // whether the creature should avoid dropping a corpse
  noCorpseDrop?: boolean;

  // whether the creature should avoid dropping items
  noItemDrop?: boolean;

  // the reputation modifications for the killer when this npc is killed
  repMod: Array<{ allegiance: Allegiance; delta: number }>;

  // the amount of skill gained by the party when this creature is killed
  skillOnKill: number;

  // the skills this creature has
  skills: SkillBlock;

  // the stats this creature has
  stats: StatBlock;

  // the modifiers (based on potency) for each stat to modify this character by
  summonStatModifiers?: Record<Stat, number>;

  // the modifiers (based on potency) for each skill to modify this character by
  summonSkillModifiers?: Record<Skill, number>;

  // the skill required to tan this creature
  tanSkillRequired?: number;

  // the item this creature tans for
  tansFor?: string;

  // the trait levels this creature has
  traitLevels?: Record<string, number>;

  // npc triggers
  triggers?: Partial<Record<NPCTriggerType, any>>;

  // npc usable skills
  usableSkills: Rollable[];

  // automatically given to green npcs, their forced x-coordinate
  x?: number;

  // automatically given to green npcs, their forced y-coordinate
  y?: number;

  // the challenge rating of the creature - scales the hp / damageFactor
  cr?: number;
}

export interface INPC extends ICharacter {
  npcId: string;
  sprite: number;
  aquaticOnly?: boolean;
  avoidWater?: boolean;
  hostility?: Hostility;
  owner?: ICharacter;
  usableSkills: Rollable[] | string[];
  monsterClass?: MonsterClass;
  monsterGroup?: string;

  noLeash?: boolean;

  skillOnKill: number;
  giveXp: { min: number; max: number };

  behaviors?: IAIBehavior[];
  onlyVisibleTo?: string;

  shouldStrip?: boolean;
  shouldEatTier?: number;
  stripRadius?: number;
  stripX?: number;
  stripY?: number;

  targetDamageDone?: any;

  noCorpseDrop?: boolean;
  noItemDrop?: boolean;
  drops?: any[];
  copyDrops?: any[];
  dropPool?: {
    replace?: boolean;
    choose: {
      min: number;
      max: number;
    };
    items: Rollable[];
  };

  allegianceMods: Array<{ delta: number; allegiance: Allegiance }>;
  traitLevels?: Record<string, number>;

  triggers?: Partial<Record<NPCTriggerType, any>>;
  maxWanderRandomlyDistance: number;

  tansFor?: string;
}

export interface INPCScript {
  tag: string;
  name?: string;
  affiliation?: string;
  hostility?: Hostility;
  level?: number;
  hp?: BoundedNumber;
  mp?: BoundedNumber;
  otherStats?: Partial<Record<Stat, number>>;
  usableSkills?: string[] | Rollable[];
  items?: ICharacterItems;
  dialog?: Record<string, any>;
  allegiance?: Allegiance;
  x?: number;
  y?: number;
  sprite?: number;
  alignment?: Alignment;
  extraProps?: string[];
}
