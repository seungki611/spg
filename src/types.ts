/**
 * Study Coin Quest Types declaration
 */

export interface Profile {
  id: string;
  nickname: string;
  coins: number;
  selected_title: string;
  created_at: string;
}

export interface StudySession {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  earned_coins: number;
  created_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_key: string;
  achieved_at: string;
}

export interface UserTitle {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
}

export interface RankingItem {
  rank: number;
  nickname: string;
  selected_title: string;
  value: number; // can be duration_minutes or coins
  is_user: boolean;
  email?: string;
}

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  requiredHours: number;
  rewardCoins: number;
  rewardTitle?: string;
  bossName: string;
  bossHp: number; // For visualization
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: 'first_study',
    name: '첫 공부 시작',
    description: '첫 공부 기록 완료하기',
    requiredHours: 0,
    rewardCoins: 50,
    rewardTitle: '첫걸음 학습자',
    bossName: '작심삼일 슬라임',
    bossHp: 10
  },
  {
    key: 'focus_beginner',
    name: '집중 입문자',
    description: '누적 공부 시간 1시간 달성',
    requiredHours: 1,
    rewardCoins: 200,
    rewardTitle: '집중 입문자',
    bossName: '스마트폰 골렘',
    bossHp: 60
  },
  {
    key: 'study_warrior',
    name: '공부 전사',
    description: '누적 공부 시간 10시간 달성',
    requiredHours: 10,
    rewardCoins: 1000,
    rewardTitle: '공부 전사',
    bossName: '유튜브 가고일',
    bossHp: 600
  },
  {
    key: 'midterm_boss',
    name: '중간고사 보스 처치',
    description: '누적 공부 시간 50시간 달성',
    requiredHours: 50,
    rewardCoins: 3000,
    rewardTitle: '중간고사 사냥꾼',
    bossName: '중간고사 붉은 드래곤',
    bossHp: 3000
  },
  {
    key: 'final_boss',
    name: '기말고사 보스 처치',
    description: '누적 공부 시간 100시간 달성',
    requiredHours: 100,
    rewardCoins: 6000,
    rewardTitle: '기말고사 정복자',
    bossName: '기말고사 죽음의 기사',
    bossHp: 6000
  },
  {
    key: 'csat_boss',
    name: '수능 보스 처치',
    description: '누적 공부 시간 300시간 달성',
    requiredHours: 300,
    rewardCoins: 20000,
    rewardTitle: '수능 정복자',
    bossName: '수능 만점의 대신관',
    bossHp: 18000
  },
  {
    key: 'legendary_student',
    name: '전설의 학습자',
    description: '누적 공부 시간 500시간 달성',
    requiredHours: 500,
    rewardCoins: 50000,
    rewardTitle: '전설의 학습자',
    bossName: '학문의 신 제우스',
    bossHp: 30000
  }
];
