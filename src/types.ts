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
  userId?: string;
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
    name: '1단계: 집중의 첫 불씨',
    description: '수련 입문 및 1시간 이상 집중 공부 달성하기',
    requiredHours: 1,
    rewardCoins: 200,
    rewardTitle: '집중 입문자',
    bossName: '침묵의 목각 연마인형',
    bossHp: 60
  },
  {
    key: 'focus_beginner',
    name: '2단계: 지식의 기초 주입',
    description: '누적 공부 시간 4시간 달성',
    requiredHours: 4,
    rewardCoins: 500,
    rewardTitle: '서당의 학도',
    bossName: '방해의 안개 정령',
    bossHp: 150
  },
  {
    key: 'study_warrior',
    name: '3단계: 학업의 첫 봉우리',
    description: '누적 공부 시간 10시간 달성',
    requiredHours: 10,
    rewardCoins: 1200,
    rewardTitle: '공부 전사',
    bossName: '잡념의 불나방 괴수',
    bossHp: 500
  },
  {
    key: 'mind_master',
    name: '4단계: 고도의 한계 극복',
    description: '누적 공부 시간 30시간 달성',
    requiredHours: 30,
    rewardCoins: 2500,
    rewardTitle: '명상의 수행자',
    bossName: '수련 동굴의 바위 파수꾼',
    bossHp: 1800
  },
  {
    key: 'midterm_boss',
    name: '5단계: 지성의 성벽 구축',
    description: '누적 공부 시간 70시간 달성',
    requiredHours: 70,
    rewardCoins: 5000,
    rewardTitle: '집중의 지배자',
    bossName: '어둠의 나태 수호자',
    bossHp: 4000
  },
  {
    key: 'final_boss',
    name: '6단계: 학문 연구의 고비',
    description: '누적 공부 시간 150시간 달성',
    requiredHours: 150,
    rewardCoins: 10000,
    rewardTitle: '지식의 파수꾼',
    bossName: '학업 슬럼프의 서리 악령',
    bossHp: 9000
  },
  {
    key: 'csat_boss',
    name: '7단계: 영적 각성의 지혜',
    description: '누적 공부 시간 300시간 달성',
    requiredHours: 300,
    rewardCoins: 25000,
    rewardTitle: '불굴의 현자',
    bossName: '한계 파멸의 고교 흑기사',
    bossHp: 20000
  },
  {
    key: 'legendary_student',
    name: '8단계: 현자의 길 입문',
    description: '누적 공부 시간 500시간 달성',
    requiredHours: 500,
    rewardCoins: 60000,
    rewardTitle: '대륙의 지각 학자',
    bossName: '고대 도서관의 환영 도플갱어',
    bossHp: 45000
  },
  {
    key: 'focus_specialist',
    name: '9단계: 성역의 학문적 조율',
    description: '누적 공부 시간 1,000시간 달성 (약 8개월 차 기점)',
    requiredHours: 1000,
    rewardCoins: 120000,
    rewardTitle: '고도의 전문직 학사',
    bossName: '수문장 대마법사 지그문트',
    bossHp: 80000
  },
  {
    key: 'master_of_will',
    name: '10단계: 시간의 지평선 돌파',
    description: '누적 공부 시간 1,500시간 달성 (약 1년 차 완성 기점)',
    requiredHours: 1500,
    rewardCoins: 200000,
    rewardTitle: '초월적 극기의 달인',
    bossName: '차원 왜곡의 태엽 수리 기어',
    bossHp: 120000
  },
  {
    key: 'time_destroyer',
    name: '11단계: 진리의 탑 수호자',
    description: '누적 공부 시간 2,000시간 달성 (약 1.3년 차)',
    requiredHours: 2000,
    rewardCoins: 300000,
    rewardTitle: '시간의 파괴자',
    bossName: '시간의 절대 종단 크로노스',
    bossHp: 160000
  },
  {
    key: 'scholar_of_truth',
    name: '12단계: 신성의 영역 각성',
    description: '누적 공부 시간 2,500시간 달성 (약 1.7년 차)',
    requiredHours: 2500,
    rewardCoins: 450000,
    rewardTitle: '진리를 깨달은 자',
    bossName: '진리 수련의 오색 빛 대천사',
    bossHp: 200000
  },
  {
    key: 'gatekeeper_of_abyss',
    name: '13단계: 지지 않는 불멸의 의지',
    description: '누적 공부 시간 3,000시간 달성 (약 2년 차 완성!)',
    requiredHours: 3000,
    rewardCoins: 600000,
    rewardTitle: '차원을 가른 탐구자',
    bossName: '심연의 어두운 학업마신 루시퍼',
    bossHp: 250000
  },
  {
    key: 'legendary_grandmaster',
    name: '14단계: 문명의 새벽 인도',
    description: '누적 공부 시간 3,500시간 달성 (약 2.4년 차)',
    requiredHours: 3500,
    rewardCoins: 800005,
    rewardTitle: '문명의 지혜 수호자',
    bossName: '신지식의 숲의 군주 프로메테우스',
    bossHp: 320000
  },
  {
    key: 'academic_overseer',
    name: '15단계: 아카식 레코드 조율',
    description: '누적 공부 시간 4,000시간 달성 (약 2.7년 차)',
    requiredHours: 4000,
    rewardCoins: 1000000,
    rewardTitle: '지혜의 절대 군주',
    bossName: '해달의 수수께끼 수호스핑크스',
    bossHp: 400000
  },
  {
    key: 'ultimate_deity',
    name: '16단계: 신화적 해탈의 정점',
    description: '누적 공부 시간 4,400시간 달성 (영광의 3개년 대장정 최종장 완료!)',
    requiredHours: 4400,
    rewardCoins: 2000000,
    rewardTitle: '학인 해탈의 신화적 영웅신',
    bossName: '아카식 레코드의 은하 주신 아스트라에아',
    bossHp: 500000
  }
];

export const TITLE_ICONS: Record<string, string> = {
  '첫걸음 학습자': '🔰',
  '초련의 학습자': '🔰',
  '👑 총괄 게임마스터 GM (개발자)': '👑',
  '집중 입문자': '🌱',
  '서당의 학도': '📝',
  '공부 전사': '⚔️',
  '명상의 수행자': '🧘',
  '집중의 지배자': '👁️‍🗨️',
  '지식의 파수꾼': '🦉',
  '불굴의 현자': '🌟',
  '대륙의 지각 학자': '📜',
  '고도의 전문직 학사': '💼',
  '초월적 극기의 달인': '💎',
  '시간의 파괴자': '⚡',
  '진리를 깨달은 자': '🌈',
  '차원을 가른 탐구자': '🌌',
  '문명의 지혜 수호자': '🏛️',
  '지혜의 절대 군주': '🔮',
  '학인 해탈의 신화적 영웅신': '✨'
};

export function getTitleIcon(title: string): string {
  if (!title) return '🏅';
  const trimmed = title.trim();
  if (trimmed.includes('GM') || trimmed.includes('관리자') || trimmed.includes('게임마스터')) {
    return '👑';
  }
  return TITLE_ICONS[trimmed] || '🏅';
}

