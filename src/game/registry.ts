import { C } from './art';
import { BalloonGame } from './balloon';
import { DinoGame } from './dino';
import { FollowGame } from './follow';
import { FruitGame } from './fruit';
import { HeliGame } from './heli';
import { IceGame } from './ice';
import { MemoryGame } from './memory';
import { RainbowGame } from './rainbow';
import { RhythmGame } from './rhythm';
import { StarGame } from './star';
import type { MiniGame } from './types';

export type GameMeta = {
  id: string;
  title: string;
  emoji: string;
  line: string;
  accent: string;
  tag: string;
  create: (players: 1 | 2, w: number, h: number) => MiniGame;
};

export const GAMES: GameMeta[] = [
  {
    id: 'balloon',
    title: '풍선 터뜨리기',
    emoji: '🎈',
    line: '손으로 콕! 풍선을 터뜨려요',
    accent: C.pink,
    tag: '팔·어깨',
    create: (p, w, h) => new BalloonGame(p, w, h),
  },
  {
    id: 'ice',
    title: '얼음 깨기',
    emoji: '🧊',
    line: '주먹으로 얼음을 깨요',
    accent: C.sky,
    tag: '팔·어깨',
    create: (p, w, h) => new IceGame(p, w, h),
  },
  {
    id: 'star',
    title: '별 따기',
    emoji: '⭐',
    line: '손을 별 위에 잠깐 올려요',
    accent: C.yellow,
    tag: '균형',
    create: (p, w, h) => new StarGame(p, w, h),
  },
  {
    id: 'dino',
    title: '땅속 친구',
    emoji: '🦖',
    line: '올라온 친구를 콕 눌러요',
    accent: C.peach,
    tag: '반응',
    create: (p, w, h) => new DinoGame(p, w, h),
  },
  {
    id: 'follow',
    title: '따라쟁이',
    emoji: '🙌',
    line: '링 안에 손을 잠깐 담아요',
    accent: C.lavender,
    tag: '협응',
    create: (p, w, h) => new FollowGame(p, w, h),
  },
  {
    id: 'memory',
    title: '짝 맞추기',
    emoji: '🃏',
    line: '같은 그림 두 장을 찾아요',
    accent: C.mint,
    tag: '기억',
    create: (p, w, h) => new MemoryGame(p, w, h),
  },
  {
    id: 'fruit',
    title: '과일 받기',
    emoji: '🍎',
    line: '바구니로 과일을 받아요',
    accent: '#ffc7a8',
    tag: '협응',
    create: (p, w, h) => new FruitGame(p, w, h),
  },
  {
    id: 'heli',
    title: '헬리콥터',
    emoji: '🚁',
    line: '손을 올려 구름 길을 가요',
    accent: '#b9dcff',
    tag: '균형',
    create: (p, w, h) => new HeliGame(p, w, h),
  },
  {
    id: 'rainbow',
    title: '무지개 잇기',
    emoji: '🌈',
    line: '두 손을 구름에 올려요',
    accent: '#cfe3ff',
    tag: '양팔',
    create: (p, w, h) => new RainbowGame(p, w, h),
  },
  {
    id: 'rhythm',
    title: '리듬 북',
    emoji: '🥁',
    line: '북에 맞춰 손을 튕겨요',
    accent: '#ffb3a7',
    tag: '리듬',
    create: (p, w, h) => new RhythmGame(p, w, h),
  },
];
