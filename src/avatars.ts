export interface AvatarStage {
  stage: number;
  name: string;
  emoji: string;
  description: string;
}

export interface AvatarDef {
  key: string;
  name: string;
  themeColor: string;
  badge: string;
  personality: string;
  stages: AvatarStage[];
}

export const AVATARS: AvatarDef[] = [
  {
    key: 'leon',
    name: '불꽃 기사 레온 (Warrior Leon)',
    themeColor: 'from-amber-500 to-rose-600',
    badge: '⚔️ 열정 & 끈기',
    personality: '나무 목검으로 시작해 대천세계를 비추는 태양신이 될 소년 검사. 정의감과 꺾이지 않는 용기를 불태웁니다.',
    stages: [
      {
        stage: 0,
        name: '꼬마 도전자 레온',
        emoji: '👦',
        description: '장난기 가득한 표정으로 꼬마 나무 검을 쥐고 흔들며 모험을 동경하는 전사 꿈나무.'
      },
      {
        stage: 1,
        name: '견습 방패 기사 레온',
        emoji: '🧑‍🛡️',
        description: '강력한 가죽 갑옷과 은빛 원형 방패를 수여받고 본격적인 체력 수련에 진입한 예비 용사.'
      },
      {
        stage: 2,
        name: '철갑 검사 레온',
        emoji: '🤺',
        description: '무거운 백마스크와 강철 예도를 가볍게 한 손으로 휘두르며 고도의 무예를 수련하는 정예 검투사.'
      },
      {
        stage: 3,
        name: '용기 기사 레온',
        emoji: '🦸‍♂️',
        description: '붉은 미스릴 대검에 이성과 학문의 불꽃 마력을 부여하여 적들을 소탕하는 화염 가디언.'
      },
      {
        stage: 4,
        name: '차원 수호 인도자 레온',
        emoji: '🧝‍♂️',
        description: '우주 도서관에서 하사받은 거대한 천상 성검과 찬란한 에메랄드 마법 갑주가 융합된 용사.'
      },
      {
        stage: 5,
        name: '불멸의 태양 검신 레온',
        emoji: '👑',
        description: '수천 시간의 고도의 극기 초월로 삼천대세계를 수호하며 공적의 정점에 등극한 영광스러운 신격 검신.'
      }
    ]
  },
  {
    key: 'luna',
    name: '비전 마법사 루나 (Sage Luna)',
    themeColor: 'from-violet-500 to-fuchsia-600',
    badge: '🔮 지성 & 우주',
    personality: '차원의 경계에 있는 대정령 도서관의 학자로 시간의 왜곡과 대천사 비술을 연구하는 똑똑한 동반자.',
    stages: [
      {
        stage: 0,
        name: '아기 마녀 루나',
        emoji: '👧',
        description: '어린 나이에 마법서 한 권과 조그만 비약 보따리를 사랑스럽게 등에 메고 모험을 시작한 소녀.'
      },
      {
        stage: 1,
        name: '돋보기 학도 루나',
        emoji: '🎓',
        description: '매우 지적인 안경을 끼고 우주 궤도 조율 비급서를 읽느라 시간 가는 줄 모르는 학사 예비생.'
      },
      {
        stage: 2,
        name: '달빛 아카식 소서리스 루나',
        emoji: '🧙‍♀️',
        description: '자신만의 원소 물약과 은하 비술 지팡이를 다루며 사념 안개를 격퇴하는 본고의 비전 마법사.'
      },
      {
        stage: 3,
        name: '엘프 대마도사 루나',
        emoji: '🧝‍♀️',
        description: '천체 원소 기류를 매만져 집중하는 용사 주변을 정화해 주는 영겁의 요정 비술 지휘자.'
      },
      {
        stage: 4,
        name: '시계태엽 집정관 루나',
        emoji: '🦸‍♀️',
        description: '차원 왜곡 안경과 황금빛 오라 제어 장비를 통해 주변 행성의 중력과 시간 속도를 제어하는 영웅.'
      },
      {
        stage: 5,
        name: '아카식 레코드 조율 신제 루나',
        emoji: '🌌',
        description: '우주 도서관의 만년 비전 지혜를 완전히 화합해 전 우주의 역사를 한 눈에 꿰뚫는 영적인 절대 지배 여신.'
      }
    ]
  },
  {
    key: 'mark',
    name: '연금술사 공학자 마크 (Engineer Mark)',
    themeColor: 'from-cyan-500 to-indigo-600',
    badge: '⚙️ 시간 & 도구',
    personality: '가속 태엽 동력장치와 집중력 모래시계 엔진을 설계하는 천재적이고 위트 있는 사이보그 정비사.',
    stages: [
      {
        stage: 0,
        name: '개척자 소년 마크',
        emoji: '👶',
        description: '방해꾼 사념들이 장난친 부품들을 고사리 손에 정밀 스패너를 들고 정렬하는 영재 솜씨.'
      },
      {
        stage: 1,
        name: '태엽 가스 연금 사제 마크',
        emoji: '🧑‍🔧',
        description: '스팀 동력 모듈의 파이프 백팩을 힘겹게 매고 기계 드론을 발명하는 데 온 힘을 쏟는 예비 장인.'
      },
      {
        stage: 2,
        name: '연구원 코드 해커 마크',
        emoji: '🧑‍💻',
        description: '강력한 정밀 고압 배터리와 특수 시카고 코어 부품들을 기판에 심어 전격을 발사하는 청년 공학도.'
      },
      {
        stage: 3,
        name: '성간 우주 비행사 마크',
        emoji: '🧑‍🚀',
        description: '우주 학업 집중 성역의 인력 가속도 저항 마그네틱 슈트를 입고 사념 가고일을 비행 소탕하는 정예 조종사.'
      },
      {
        stage: 4,
        name: '차원 무한 거신 마크',
        emoji: '🤖',
        description: '중력을 역행해 고효율 학습 가속 부스팅 오라를 구동할 수 있는 사이보그 시간 동력 기어 로봇.'
      },
      {
        stage: 5,
        name: '태계 기어 카이저 신룡 마크',
        emoji: '☄️⚙️',
        description: '최종 대성역의 정밀 공학의 대통합을 완수하여 시간의 균열을 통제하는 우주 시계 공조 창조신.'
      }
    ]
  },
  {
    key: 'aria',
    name: '수호 영령 아리아 (Aria Archer)',
    themeColor: 'from-teal-400 to-emerald-600',
    badge: '🌿 백숲 & 구원',
    personality: '자연의 숨결과 신비 가득 오로라 이슬의 마력으로 태어나 상처를 고치고 사념을 꿰뚫는 엘프 정령.',
    stages: [
      {
        stage: 0,
        name: '빛나는 아기 정령 아리아',
        emoji: '💫',
        description: '세상의 자연 이치를 지식으로 승화시키려는 정령 성전에 이끌려 공중을 방랑하는 아기 불빛.'
      },
      {
        stage: 1,
        name: '수풀 보초 요정 아리아',
        emoji: '🧚‍♂️',
        description: '고대 천상 도서관 밑동에서 피어난 꽃망울 요정으로 지성 새벽 마법 이슬을 채집하는 귀여움.'
      },
      {
        stage: 2,
        name: '아스트라 조화 사수 아리아',
        emoji: '🏹',
        description: '은하수의 조율 광채를 정밀하게 엮은 광자 레이 샤프 슈팅 보우로 잡념 안개를 정화하는 성수.'
      },
      {
        stage: 3,
        name: '치유의 우드 드루이드 아리아',
        emoji: '🌿🔮',
        description: '천성 세계목의 무구한 지혜에 접목해 수련자들의 스트레스 유발 악령을 차단해 주는 평화 사제.'
      },
      {
        stage: 4,
        name: '오색 원소 수호 수장 아리아',
        emoji: '👸',
        description: '대륙 기류에 평온 가속 버프 마법을 연주하여 악의 나태 슬럼프 서리 악령을 일소시키는 엘프 숲의 여황.'
      },
      {
        stage: 5,
        name: '영원의 백성 보호 여신 아리아',
        emoji: '✨',
        description: '극강의 3년 고뇌와 공부를 승리로 마감해 성전 역사의 아카이브에 지혜신 지위로 수록된 아스트랄 성령신.'
      }
    ]
  }
];

export function getEvolutionStageIndex(completedCount: number): number {
  if (completedCount < 1) return 0;   // No achievements done (Stage 0)
  if (completedCount <= 2) return 1;  // 1-2 completed (Stage 1)
  if (completedCount <= 5) return 2;  // 3-5 completed (Stage 2)
  if (completedCount <= 9) return 3;  // 6-9 completed (Stage 3)
  if (completedCount <= 13) return 4; // 10-13 completed (Stage 4)
  return 5;                           // 14+ achievements completed (Stage 5)
}
