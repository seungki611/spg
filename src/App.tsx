import { useState, useEffect, useMemo, useRef, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Square,
  Award,
  Trophy,
  History,
  User,
  LogOut,
  Coins,
  Flame,
  Check,
  CheckCircle2,
  Lock,
  Unlock,
  Clock,
  Sparkles,
  Database,
  BookOpen,
  Info,
  Sliders,
  TrendingUp,
  Shield,
  Edit2,
  Plus,
  Sun,
  Moon,
  Store
} from 'lucide-react';
import { DBProvider } from './dbProvider';
import { supabase } from './supabaseClient';
import { ACHIEVEMENTS, Profile, StudySession, UserAchievement, UserTitle, RankingItem } from './types';
import { AVATARS, getEvolutionStageIndex } from './avatars';

// Safe LocalStorage helper for Sandboxed iFrame Environment
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`localStorage.getItem blocked for key ${key}:`, e);
      return safeLocalStorage.fallbackStorage[key] || null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`localStorage.setItem blocked for key ${key}:`, e);
      safeLocalStorage.fallbackStorage[key] = value;
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`localStorage.removeItem blocked for key ${key}:`, e);
      delete safeLocalStorage.fallbackStorage[key];
    }
  },
  fallbackStorage: {} as Record<string, string>
};

export default function App() {
  // Theme state: 'light' | 'dark'
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (safeLocalStorage.getItem('coinquest_theme') as 'light' | 'dark') || 'dark';
  });

  // Theme synchronization effect with local storage and root class
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    safeLocalStorage.setItem('coinquest_theme', theme);
  }, [theme]);

  // DB & Auth State
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSupabaseMode, setIsSupabaseMode] = useState(false);

  // Tab State: 'dashboard' | 'history' | 'achievements' | 'rankings' | 'profile' | 'shop'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'achievements' | 'rankings' | 'profile' | 'shop'>('dashboard');
  const [historySubTab, setHistorySubTab] = useState<'time' | 'coins'>('time');

  // Timer State
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Time and Reward Multipliers State
  const [timeSpeedMultiplier, setTimeSpeedMultiplier] = useState<number>(1);
  const [goldRateMultiplier, setGoldRateMultiplier] = useState<number>(1);

  // Shop Upgrades Inventory State
  const [shopUpgrades, setShopUpgrades] = useState<{
    timeSpeedLimit: number;
    goldRateLimit: number;
    auroraWings: boolean;
    steamCrown: boolean;
  }>(() => {
    try {
      const stored = safeLocalStorage.getItem('coinquest_shop_upgrades');
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return {
      timeSpeedLimit: 1, // Max allowed multiplier (purchasable progression: 1, 5, 10, 120)
      goldRateLimit: 1,  // Max allowed multiplier (purchasable progression: 1, 2, 3, 5)
      auroraWings: false,
      steamCrown: false
    };
  });

  // Sync shop upgrades to local storage
  useEffect(() => {
    safeLocalStorage.setItem('coinquest_shop_upgrades', JSON.stringify(shopUpgrades));
  }, [shopUpgrades]);

  // Hook multipliers into active speed states when loaded
  useEffect(() => {
    // When shop unlocks higher speeds, make default multiplier active
    setTimeSpeedMultiplier(1);
    setGoldRateMultiplier(shopUpgrades.goldRateLimit);
  }, [shopUpgrades]);

  // Test Utilities / Sandbox Mode Toggles
  const [cheatSpeedEnabled, setCheatSpeedEnabled] = useState(false); // 1s real = 1m gamified
  const [sandboxVisible, setSandboxVisible] = useState(true);
  const [rushDurationInput, setRushDurationInput] = useState<number>(10);
  const [coinRushRemaining, setCoinRushRemaining] = useState<number>(0);
  const [timeRushRemaining, setTimeRushRemaining] = useState<number>(0);
  const [coinRushMultInput, setCoinRushMultInput] = useState<number>(3);
  const [timeRushMultInput, setTimeRushMultInput] = useState<number>(120);

  // Auth Inputs
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);

  // Data Collections
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [titles, setTitles] = useState<UserTitle[]>([]);
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [rankingType, setRankingType] = useState<'today' | 'week' | 'total' | 'coins'>('today');

  // Modals & Celebrations
  const [sessionFinishReward, setSessionFinishReward] = useState<{
    minutes: number;
    baseCoins: number;
    bonusCoins: number;
    totalCoins: number;
    isCoinRush?: boolean;
  } | null>(null);
  const [bossClearCelebration, setBossClearCelebration] = useState<{
    bossName: string;
    achievementName: string;
    coinsReward: number;
    titleReward?: string;
  } | null>(null);

  // Profile Edit fields
  const [newNickname, setNewNickname] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // --- Avatar Selection States ---
  const [selectedAvatarKey, setSelectedAvatarKey] = useState<string>('leon');

  // --- Remember Login Info State ---
  const [rememberMe, setRememberMe] = useState(true);

  // --- Admin User Directory Control Panel States (Developer Exclusive) ---
  const [adminUserList, setAdminUserList] = useState<any[]>([]);
  const [adminPanelSubTab, setAdminPanelSubTab] = useState<'directory' | 'debug_magic'>('directory');
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [adminUserSearchQuery, setAdminUserSearchQuery] = useState('');
  const [grantCoinsInput, setGrantCoinsInput] = useState<number>(10000);
  const [grantHoursInput, setGrantHoursInput] = useState<number>(4);

  // Sync selected avatar on user loaded
  useEffect(() => {
    if (currentUser) {
      const stored = safeLocalStorage.getItem(`quest_selected_avatar_${currentUser.id}`) || 'leon';
      setSelectedAvatarKey(stored);
    }
  }, [currentUser]);

  // Sync saved login credentials on startup
  useEffect(() => {
    const savedEmail = safeLocalStorage.getItem('coinquest_remembered_email') || '';
    const savedPwd = safeLocalStorage.getItem('coinquest_remembered_password') || '';
    if (savedEmail) {
      setEmail(savedEmail);
      setPassword(savedPwd);
    }
  }, []);

  // Compute active evolving companion avatar details
  const activeAvatarDef = useMemo(() => {
    const av = AVATARS.find(a => a.key === selectedAvatarKey) || AVATARS[0];
    const stageIdx = getEvolutionStageIndex(achievements.length);
    const activeStage = av.stages[stageIdx] || av.stages[0];
    return {
      definition: av,
      stage: activeStage,
      stageIndex: stageIdx
    };
  }, [selectedAvatarKey, achievements]);

  const handleSelectAvatar = (avKey: string) => {
    if (!currentUser) return;
    setSelectedAvatarKey(avKey);
    safeLocalStorage.setItem(`quest_selected_avatar_${currentUser.id}`, avKey);
    showToast(`🐾 아바타 파트너가 '${AVATARS.find(a => a.key === avKey)?.name}'(으)로 동기화되었습니다!`, 'success');
  };

  // Admin Refresher for all users information
  const loadAdminUserData = async () => {
    if (currentUser?.email === 'seungki611@gmail.com') {
      try {
        const users = await DBProvider.getAllUsersAdminData();
        setAdminUserList(users);
        if (users.length > 0 && !selectedAdminId) {
          setSelectedAdminId(users[0].id);
        }
      } catch (err) {
        console.error('Failed to query admin user structures:', err);
      }
    }
  };

  const handleAdminGrantCoins = async (targetId: string, amount: number) => {
    try {
      await DBProvider.grantCoinsToUser(targetId, amount);
      showToast(`🪙 대상 모험가에게 금마법 골드 +${amount.toLocaleString()} 닢을 성공적으로 수여했습니다!`, 'success');
      await loadAdminUserData();
      if (targetId === currentUser?.id) {
        await checkUserSession();
        await loadUserData();
      }
    } catch (err) {
      showToast('골드 마력 부여 중 지맥 결손 오류발생.', 'error');
    }
  };

  const handleAdminGrantTime = async (targetId: string, hours: number) => {
    try {
      const minutes = Math.round(hours * 60);
      await DBProvider.grantTimeToUser(targetId, minutes);
      showToast(`⏱️ 대상 모험가에게 전투 시간 +${hours}공헌시간(약 ${minutes}분)을 주입 완료했습니다!`, 'success');
      await loadAdminUserData();
      if (targetId === currentUser?.id) {
        await checkUserSession();
        await loadUserData();
      }
    } catch (err) {
      showToast('시간 공헌치 주입 마력 전계 결속 오류 발생.', 'error');
    }
  };

  const handleAdminGrantCoinRush = async (targetId: string, durationMinutes: number, multiplier: number = 3) => {
    try {
      if (durationMinutes <= 0) {
        showToast('러쉬 부여 시간은 1분 이상이어야 합니다.', 'error');
        return;
      }
      const expiry = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
      localStorage.setItem(`quest_coin_rush_until_${targetId}`, expiry);
      localStorage.setItem(`quest_coin_rush_mult_${targetId}`, String(multiplier));
      
      const foundUser = adminUserList.find(u => u.id === targetId);
      const nickname = foundUser ? foundUser.nickname : '모험가';
      showToast(`🪙 [코인 러쉬] ${nickname}님에게 ${durationMinutes}분간의 ${multiplier}배 수확 가호가 성공적으로 부여되었습니다!`, 'success');
      
      await loadAdminUserData();
      if (targetId === currentUser?.id) {
        setCoinRushRemaining(durationMinutes * 60);
      }
    } catch (err) {
      showToast('코인 러쉬 가호 부여 중 신비로운 마력 왜곡 발생.', 'error');
    }
  };

  const handleAdminGrantTimeRush = async (targetId: string, durationMinutes: number, multiplier: number = 120) => {
    try {
      if (durationMinutes <= 0) {
        showToast('러쉬 부여 시간은 1분 이상이어야 합니다.', 'error');
        return;
      }
      const expiry = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
      localStorage.setItem(`quest_time_rush_until_${targetId}`, expiry);
      localStorage.setItem(`quest_time_rush_mult_${targetId}`, String(multiplier));
      
      const foundUser = adminUserList.find(u => u.id === targetId);
      const nickname = foundUser ? foundUser.nickname : '모험가';
      showToast(`⚡ [시간 러쉬] ${nickname}님에게 ${durationMinutes}분간의 ${multiplier}배속 축적 가호가 성공적으로 부여되었습니다!`, 'success');
      
      await loadAdminUserData();
      if (targetId === currentUser?.id) {
        setTimeRushRemaining(durationMinutes * 60);
      }
    } catch (err) {
      showToast('시간 러쉬 가호 부여 중 신비로운 마력 왜곡 발생.', 'error');
    }
  };

  const getCoinRushRemainingSec = (userId: string): number => {
    try {
      const expiry = localStorage.getItem(`quest_coin_rush_until_${userId}`);
      if (!expiry) return 0;
      const rem = Math.floor((new Date(expiry).getTime() - Date.now()) / 1000);
      return rem > 0 ? rem : 0;
    } catch (e) {
      return 0;
    }
  };

  const getTimeRushRemainingSec = (userId: string): number => {
    try {
      const expiry = localStorage.getItem(`quest_time_rush_until_${userId}`);
      if (!expiry) return 0;
      const rem = Math.floor((new Date(expiry).getTime() - Date.now()) / 1000);
      return rem > 0 ? rem : 0;
    } catch (e) {
      return 0;
    }
  };

  const checkTimeRushActive = (): boolean => {
    if (!currentUser) return false;
    try {
      const expiry = localStorage.getItem(`quest_time_rush_until_${currentUser.id}`);
      if (!expiry) return false;
      return new Date(expiry).getTime() > Date.now();
    } catch (e) {
      return false;
    }
  };

  // Poll Rushes every second to show real-time countdown
  useEffect(() => {
    if (!currentUser) {
      setCoinRushRemaining(0);
      setTimeRushRemaining(0);
      return;
    }

    const interval = setInterval(() => {
      const coinRem = getCoinRushRemainingSec(currentUser.id);
      const timeRem = getTimeRushRemainingSec(currentUser.id);
      setCoinRushRemaining(coinRem);
      setTimeRushRemaining(timeRem);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.email === 'seungki611@gmail.com') {
      loadAdminUserData();
    }
  }, [currentUser, achievements, studySessions, titles]);

  // Custom Toast State (replaces iframe-incompatible window.alert)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimeoutRef = useRef<any>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Timer tick reference
  const intervalRef = useRef<any>(null);

  // Load active connection configuration on startup
  useEffect(() => {
    setIsSupabaseMode(DBProvider.isSupabase());
    checkUserSession();
  }, []);

  // Sync state once user is logged in
  useEffect(() => {
    if (currentUser) {
      loadUserData();
      // Restore active study session if stored in client session
      const savedTimer = safeLocalStorage.getItem('quest_timer_started_at');
      if (savedTimer) {
        setTimerStartedAt(savedTimer);
        setIsTimerRunning(true);
      }
    }
  }, [currentUser]);

  // Rankings reload trigger
  useEffect(() => {
    if (currentUser && currentProfile) {
      loadRankings();
    }
  }, [currentUser, currentProfile, rankingType, studySessions]);

  // Supabase Real-time sync for study_sessions and profiles changes
  useEffect(() => {
    if (!isSupabaseMode || !currentUser || !supabase) return;
    
    // Subscribe to both 'profiles' and 'study_sessions' table modifications in real-time
    const channel = supabase
      .channel('realtime-rankings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'study_sessions' },
        () => {
          loadRankings();
          // Also fetch list of sessions to update graph dynamically
          DBProvider.getStudySessions(currentUser.id)
            .then(sessions => setStudySessions(sessions))
            .catch(err => console.error('study_sessions sync error:', err));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload: any) => {
          loadRankings();
          // If our own profile updated on another device or directly
          if (payload.new && payload.new.id === currentUser.id) {
            setCurrentProfile(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSupabaseMode, currentUser]);

  // Backup polling sync for rankings and user sessions (every 15 seconds)
  useEffect(() => {
    if (!currentUser || !currentProfile) return;
    
    const pollInterval = setInterval(() => {
      loadRankings();
    }, 15000); // 15s interval
    
    return () => clearInterval(pollInterval);
  }, [currentUser, currentProfile, rankingType]);

  // Live stopwatch update
  useEffect(() => {
    if (isTimerRunning && timerStartedAt) {
      // Periodic timer ticking
      intervalRef.current = setInterval(() => {
        const startMs = new Date(timerStartedAt).getTime();
        const nowMs = Date.now();
        const diffSecs = Math.floor((nowMs - startMs) / 1000);

        // Check if Time Rush is active (120x speed)
        const hasTimeRush = checkTimeRushActive();
        const finalMultiplier = hasTimeRush 
          ? 120 
          : (cheatSpeedEnabled ? 60 : timeSpeedMultiplier);
          
        setElapsedSeconds(diffSecs * finalMultiplier);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setElapsedSeconds(0);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isTimerRunning, timerStartedAt, cheatSpeedEnabled, timeSpeedMultiplier, timeRushRemaining]);

  // Compute stats dynamically from completed sessions
  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Start of this week (Monday)
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfWeekTime = startOfWeek.getTime();

    // Start of this month
    const startOfMonthTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let todayMin = 0;
    let weekMin = 0;
    let monthMin = 0;
    let totalMin = 0;

    const minutesPerDate: Record<string, number> = {};
    const qualifyingDates = new Set<string>();

    studySessions.forEach(s => {
      if (!s || !s.started_at) return;
      const duration = s.duration_minutes || 0;
      const startedTime = new Date(s.started_at).getTime();

      totalMin += duration;

      const dateStr = s.started_at.split('T')[0] || '1970-01-01';
      minutesPerDate[dateStr] = (minutesPerDate[dateStr] || 0) + duration;

      if (minutesPerDate[dateStr] >= 10) {
        qualifyingDates.add(dateStr);
      }

      if (startedTime >= startOfToday) {
        todayMin += duration;
      }
      if (startedTime >= startOfWeekTime) {
        weekMin += duration;
      }
      if (startedTime >= startOfMonthTime) {
        monthMin += duration;
      }
    });

    // Calculate Consecutive Streak (Backwards traversal)
    let streak = 0;
    const todayKey = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().split('T')[0];

    // If studied today or yesterday, streak is currently active
    const hasStudiedToday = (minutesPerDate[todayKey] || 0) >= 10;
    const hasStudiedYesterday = (minutesPerDate[yesterdayKey] || 0) >= 10;

    if (hasStudiedToday || hasStudiedYesterday) {
      let checkDate = hasStudiedToday ? new Date() : yesterday;
      while (true) {
        const checkKey = checkDate.toISOString().split('T')[0];
        if (qualifyingDates.has(checkKey)) {
          streak++;
          // Step back 1 day
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    return {
      todayPercent: Math.min(100, Math.floor(((minutesPerDate[todayKey] || 0) / 10) * 100)),
      todayMin,
      weekMin,
      monthMin,
      totalMin,
      streak,
      todayStudied: hasStudiedToday,
      todayTotalMinutes: minutesPerDate[todayKey] || 0
    };
  }, [studySessions]);

  // Find active boss quest goal for Dashboard Bento display
  const currentBoss = useMemo(() => {
    const unlockedKeys = new Set(achievements.map(a => a.achievement_key));
    const nextBoss = ACHIEVEMENTS.find(ach => !unlockedKeys.has(ach.key));
    return nextBoss || ACHIEVEMENTS[ACHIEVEMENTS.length - 1];
  }, [achievements]);

  // Auth Functions
  const checkUserSession = async () => {
    try {
      setLoading(true);
      const user = await DBProvider.getCurrentUser();
      setCurrentUser(user);
    } catch (err) {
      console.error('Session retrieval failed', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUserData = async () => {
    if (!currentUser) return;
    try {
      const profile = await DBProvider.getProfile(currentUser.id);
      setCurrentProfile(profile);
      if (profile) {
        setNewNickname(profile.nickname);
      }

      const sessions = await DBProvider.getStudySessions(currentUser.id);
      setStudySessions(sessions);

      const achieved = await DBProvider.getAchievements(currentUser.id);
      setAchievements(achieved);

      const userTitles = await DBProvider.getTitles(currentUser.id);
      setTitles(userTitles);

    } catch (err) {
      console.error('Error loading user tables:', err);
    }
  };

  const loadRankings = async () => {
    if (!currentUser || !currentProfile) return;
    try {
      const rankingList = await DBProvider.getRankings(
        currentUser.id,
        currentProfile,
        stats.todayMin,
        stats.weekMin,
        stats.totalMin,
        rankingType
      );
      setRankings(rankingList);
    } catch (err) {
      console.error('Leaderboard query failing:', err);
    }
  };

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessMsg(null);

    if (!email || !password) {
      setAuthError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    if (authTab === 'register' && !nickname.trim()) {
      setAuthError('닉네임을 설정해 주세요.');
      return;
    }

    try {
      setLoading(true);
      if (authTab === 'register') {
        const user = await DBProvider.signUp(email, password, nickname.trim());
        setAuthSuccessMsg('회원가입 완료! 자동 환영 로그인을 시도합니다.');
        setCurrentUser(user);
        
        if (rememberMe) {
          safeLocalStorage.setItem('coinquest_remembered_email', email);
          safeLocalStorage.setItem('coinquest_remembered_password', password);
        } else {
          safeLocalStorage.removeItem('coinquest_remembered_email');
          safeLocalStorage.removeItem('coinquest_remembered_password');
        }
      } else {
        const user = await DBProvider.signIn(email, password);
        setCurrentUser(user);

        if (rememberMe) {
          safeLocalStorage.setItem('coinquest_remembered_email', email);
          safeLocalStorage.setItem('coinquest_remembered_password', password);
        } else {
          safeLocalStorage.removeItem('coinquest_remembered_email');
          safeLocalStorage.removeItem('coinquest_remembered_password');
        }
      }
    } catch (err: any) {
      setAuthError(err.message || '인증 처리에 실패하였습니다.');
    } finally {
      setLoading(false);
    }
  };

  // One-click quick guest onboarding
  const handleQuickGuestOnboarding = async () => {
    setAuthError(null);
    const guestRand = Math.floor(100 + Math.random() * 900);
    const guestEmail = `guest_${guestRand}@coinquest.local`;
    const guestPassword = `guestpwd_${guestRand}`;
    const guestNickname = `초보도전자 ${guestRand}`;

    try {
      setLoading(true);
      // Force Local Storage fallback for guest mode so it never hits Supabase signUp rate-limits or confirmation blocks!
      try {
        localStorage.setItem('quest_force_local_mode', 'true');
      } catch (e) {
        console.warn('localStorage not available', e);
      }
      setIsSupabaseMode(false);

      // Run signup in local mode
      const user = await DBProvider.signUp(guestEmail, guestPassword, guestNickname);
      setCurrentUser(user);
      showToast('💾 쾌적한 로컬 체험 세션으로 모험을 성공적으로 가입 개시했습니다!', 'success');
    } catch (err: any) {
      setAuthError('빠른 체험 세션 가입 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      // Terminate running timer first
      setIsTimerRunning(false);
      setTimerStartedAt(null);
      safeLocalStorage.removeItem('quest_timer_started_at');

      await DBProvider.signOut();
      setCurrentUser(null);
      setCurrentProfile(null);
      setStudySessions([]);
      setAchievements([]);
      setTitles([]);
      setActiveTab('dashboard');
    } catch (err) {
      console.error('Logout error', err);
    } finally {
      setLoading(false);
    }
  };

  // Timer Core Actions
  const handleStartTimer = () => {
    const startedStr = new Date().toISOString();
    setTimerStartedAt(startedStr);
    setIsTimerRunning(true);
    safeLocalStorage.setItem('quest_timer_started_at', startedStr);
  };

  const handleStopTimer = async () => {
    if (!timerStartedAt || !currentUser) return;

    // Read end time
    const endedStr = new Date().toISOString();
    const runtimeSec = elapsedSeconds;
    const runtimeMin = Math.max(1, Math.floor(runtimeSec / 60)); // Standard min 1

    // Enforce 1 minute minimum threshold for storage
    if (runtimeSec < 60) {
      showToast('너무 짧은 기록은 저장되지 않습니다. 최소 1분 이상 공부해야 코인이 지급됩니다! (샌드박스 배속 또는 수동 입력을 이용하면 고속 테스트가 가능합니다)', 'error');
      setIsTimerRunning(false);
      setTimerStartedAt(null);
      safeLocalStorage.removeItem('quest_timer_started_at');
      return;
    }

    try {
      setIsTimerRunning(false);
      setTimerStartedAt(null);
      safeLocalStorage.removeItem('quest_timer_started_at');
      setLoading(true);

      // Check for Coin Rush multiplier active state (3x payout boost)
      let activeGoldMultiplier = goldRateMultiplier;
      let isCoinRushActive = false;
      const coinRushExpiry = localStorage.getItem(`quest_coin_rush_until_${currentUser.id}`);
      if (coinRushExpiry) {
        if (new Date(coinRushExpiry).getTime() > Date.now()) {
          isCoinRushActive = true;
          activeGoldMultiplier = activeGoldMultiplier * 3; // Triple rewards during coin rush!
        }
      }

      // Reward Calculations
      // 1 minute = 1 Coin, scaled by active gold payout rate multiplier
      const baseCoins = Math.round(runtimeMin * activeGoldMultiplier);
      let bonusCoins = 0;
      if (runtimeMin >= 120) {
        bonusCoins = Math.round(80 * activeGoldMultiplier);
      } else if (runtimeMin >= 60) {
        bonusCoins = Math.round(30 * activeGoldMultiplier);
      } else if (runtimeMin >= 30) {
        bonusCoins = Math.round(10 * activeGoldMultiplier);
      }

      const totalEarned = baseCoins + bonusCoins;

      // Persist to DB
      await DBProvider.addStudySession(
        currentUser.id,
        timerStartedAt,
        endedStr,
        runtimeMin,
        totalEarned
      );

      // Show reward breakout modal
      setSessionFinishReward({
        minutes: runtimeMin,
        baseCoins,
        bonusCoins,
        totalCoins: totalEarned,
        isCoinRush: isCoinRushActive
      });

      // Reload profile & stats and trigger achievements check
      await triggerSyncAndAchievementsCheck(runtimeMin);

    } catch (err) {
      console.error('Stop timer fail:', err);
    } finally {
      setLoading(false);
    }
  };

  // Achievement Check & Award Trigger
  const triggerSyncAndAchievementsCheck = async (addedMin: number = 0) => {
    if (!currentUser) return;

    try {
      // 1. Reload general tables
      const updatedProfile = await DBProvider.getProfile(currentUser.id);
      setCurrentProfile(updatedProfile);

      const updatedSessions = await DBProvider.getStudySessions(currentUser.id);
      setStudySessions(updatedSessions);

      // Calculate total accumulative hours
      const totalAccumulatedMinutes = updatedSessions.reduce((sum, s) => sum + s.duration_minutes, 0);
      const totalAccumulatedHours = totalAccumulatedMinutes / 60;

      // 2. Fetch already unlocked achievements to bypass duplicates
      const currentAchievements = await DBProvider.getAchievements(currentUser.id);
      setAchievements(currentAchievements);

      const unlockedKeys = new Set(currentAchievements.map(a => a.achievement_key));

      // 3. Scan Achievements definitions and unlock if eligible
      for (const ach of ACHIEVEMENTS) {
        if (unlockedKeys.has(ach.key)) continue;

        let eligible = false;
        if (ach.key === 'first_study') {
          eligible = updatedSessions.length >= 1;
        } else {
          eligible = totalAccumulatedHours >= ach.requiredHours;
        }

        if (eligible) {
          // Perform unlock logic
          const didUnlock = await DBProvider.unlockAchievement(
            currentUser.id,
            ach.key,
            ach.rewardCoins,
            ach.rewardTitle
          );

          if (didUnlock) {
            // Trigger beautiful celebration popup
            setBossClearCelebration({
              bossName: ach.bossName,
              achievementName: ach.name,
              coinsReward: ach.rewardCoins,
              titleReward: ach.rewardTitle
            });
            // Break loop to show one celebration modal at a time
            break;
          }
        }
      }

      // Reload collection listings
      const updatedTitles = await DBProvider.getTitles(currentUser.id);
      setTitles(updatedTitles);

      const reProfile = await DBProvider.getProfile(currentUser.id);
      setCurrentProfile(reProfile);

    } catch (err) {
      console.error('Error in achievements processing:', err);
    }
  };

  // Sandbox cheat loaders to ease validation - updated to take target/selected user parameter
  const injectMockStudySession = async (targetUserId?: string, minutes: number = 60) => {
    const activeUserId = targetUserId || currentUser?.id;
    if (!activeUserId) return;
    try {
      setLoading(true);
      const now = new Date();
      const past = new Date(now.getTime() - minutes * 60 * 1000);

      // Calculate coins
      const baseCoins = minutes;
      let bonusCoins = 0;
      if (minutes >= 120) bonusCoins = 80;
      else if (minutes >= 60) bonusCoins = 30;
      else if (minutes >= 30) bonusCoins = 10;
      const earned = baseCoins + bonusCoins;

      await DBProvider.addStudySession(
        activeUserId,
        past.toISOString(),
        now.toISOString(),
        minutes,
        earned
      );

      const targetProfile = await DBProvider.getProfile(activeUserId);
      const nickname = targetProfile ? targetProfile.nickname : '모험가';
      showToast(`⚔️ [전투 수련기록 주입] ${nickname}님에게 +${minutes}분 집중 전적 및 +${earned}골드를 가산했습니다!`, 'success');

      await loadAdminUserData();
      if (activeUserId === currentUser?.id) {
        setSessionFinishReward({
          minutes,
          baseCoins,
          bonusCoins,
          totalCoins: earned
        });
        await triggerSyncAndAchievementsCheck(minutes);
      }
    } catch (err) {
      console.error('Sandbox inject study fail:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCoinsCheat = async (targetUserId?: string) => {
    const activeUserId = targetUserId || currentUser?.id;
    if (!activeUserId) return;
    try {
      setLoading(true);
      const targetProfile = await DBProvider.getProfile(activeUserId);
      if (!targetProfile) return;
      const updatedCoins = (targetProfile.coins || 0) + 1000;
      const upProfile = await DBProvider.updateProfile(activeUserId, { coins: updatedCoins });
      if (activeUserId === currentUser?.id) {
        setCurrentProfile(upProfile);
      }
      showToast(`🪙 대상 모험가의 국고에 황장 골드 +1,000 주입을 완료했습니다!`, 'success');
      await loadAdminUserData();
    } catch (err) {
      console.error('Sandbox coin cheat failure:', err);
    } finally {
      setLoading(false);
    }
  };

  // Developer Super Cheat Action - parameterized
  const handleDeveloperSuperCheat = async (targetUserId?: string) => {
    const activeUserId = targetUserId || currentUser?.id;
    if (!activeUserId) return;
    try {
      setLoading(true);
      const targetProfile = await DBProvider.getProfile(activeUserId);
      if (!targetProfile) {
        showToast('대상 모험가의 프로필을 탐색하지 못했습니다.', 'error');
        return;
      }

      // Give 1,000,000 coins + set supreme GM Title
      const upProfile = await DBProvider.updateProfile(activeUserId, { 
        coins: (targetProfile.coins || 0) + 1000000,
        selected_title: '👑 총괄 게임마스터 GM (개발자)'
      });
      if (activeUserId === currentUser?.id) {
        setCurrentProfile(upProfile);
      }
      
      // Inject all titles in DB for swift game testing
      if (isSupabaseMode && supabase) {
        for (const ach of ACHIEVEMENTS) {
          try {
            if (ach.rewardTitle) {
              await supabase
                .from('user_titles')
                .insert({ user_id: activeUserId, title: ach.rewardTitle });
            }
          } catch (e) {
            // ignore duplicate entries
          }

          try {
            await supabase
              .from('user_achievements')
              .insert({ user_id: activeUserId, achievement_key: ach.key });
          } catch (e) {
            // ignore duplicate entries
          }
        }
      } else {
        const titlesRaw = safeLocalStorage.getItem('quest_titles') || '[]';
        let titlesLocal = [];
        try {
          titlesLocal = JSON.parse(titlesRaw);
        } catch (e) {
          titlesLocal = [];
        }
        
        const achievementsRaw = safeLocalStorage.getItem('quest_achievements') || '[]';
        let achievementsLocal = [];
        try {
          achievementsLocal = JSON.parse(achievementsRaw);
        } catch (e) {
          achievementsLocal = [];
        }

        ACHIEVEMENTS.forEach(ach => {
          if (ach.rewardTitle && !titlesLocal.some((t: any) => t.user_id === activeUserId && t.title === ach.rewardTitle)) {
            titlesLocal.push({ 
              id: 'dev-' + Math.random().toString(36).substr(2, 9), 
              user_id: activeUserId, 
              title: ach.rewardTitle, 
              created_at: new Date().toISOString() 
            });
          }
          if (!achievementsLocal.some((a: any) => a.user_id === activeUserId && a.achievement_key === ach.key)) {
            achievementsLocal.push({
              id: 'dev-ach-' + Math.random().toString(36).substr(2, 9),
              user_id: activeUserId,
              achievement_key: ach.key,
              achieved_at: new Date().toISOString()
            });
          }
        });
        safeLocalStorage.setItem('quest_titles', JSON.stringify(titlesLocal));
        safeLocalStorage.setItem('quest_achievements', JSON.stringify(achievementsLocal));
      }
      
      await loadAdminUserData();
      if (activeUserId === currentUser?.id) {
        await loadUserData();
      }
      showToast(`⚡ '${targetProfile.nickname}' 모험가에게 GM 권한 부여 및 전 서버 타이틀 잠금해제가 반영되었습니다!`, 'success');
    } catch (err: any) {
      console.error('Developer super cheat fail:', err);
      showToast('개발자 치트 처리 중 에러가 발생했습니다: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Developer exclusive action to delete rankings records
  const handleDeleteRankingUser = async (targetUserId: string, nickname: string) => {
    try {
      setLoading(true);
      await DBProvider.deleteUserRecord(targetUserId);
      setDeletingUserId(null);
      showToast(`⚡ '${nickname}' 모험가의 모든 전적을 제거하고 명예의 전당 보드에서 축출하였습니다.`, 'success');
      // reload rankings
      await loadRankings();
    } catch (err: any) {
      console.error('Failed to delete ranking user:', err);
      showToast('모험가 전적 축출 중 오류가 발생했습니다: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Developer exclusive action to reset user individual categories (today, week, total, coins)
  const handleAdminResetCategory = async (targetUserId: string, nickname: string, category: 'today' | 'week' | 'total' | 'coins') => {
    let catName = '';
    if (category === 'today') catName = '일일 격투 (오늘 시간)';
    if (category === 'week') catName = '주간 원정 (이번주 시간)';
    if (category === 'total') catName = '저널의 공적 (누적 시간)';
    if (category === 'coins') catName = '부의 축적 (보유 골드)';

    if (confirm(`⚠️ 정말로 [${nickname}] 모험가의 [${catName}] 데이터를 초기화하여 삭제 조치하시겠습니까?`)) {
      try {
        setLoading(true);
        await DBProvider.adminResetCategory(targetUserId, category);
        showToast(`✨ '${nickname}' 모험가의 [${catName}] 전적이 완전히 초기화 소멸되었습니다.`, 'success');
        await loadRankings();
        if (targetUserId === currentUser?.id) {
          await checkUserSession();
          await loadUserData();
        }
      } catch (err: any) {
        console.error('Failed to reset category:', err);
        showToast('전적 삭제 중 오류가 발생했습니다: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  // Purchase Shop Upgrades
  const handleBuyItem = async (itemId: string, cost: number) => {
    if (!currentUser || !currentProfile) return;
    if (currentProfile.coins < cost) {
      showToast('🪙 보유한 골드가 부족하여 물품 계약을 개시할 수 없습니다! 수련 세션을 완료하여 골드를 더 축적하십시오.', 'error');
      return;
    }

    try {
      setLoading(true);
      const remainingCoins = currentProfile.coins - cost;

      // Update backend profile coins
      const updatedProfile = await DBProvider.updateProfile(currentUser.id, { coins: remainingCoins });
      setCurrentProfile(updatedProfile);

      // Mutate corresponding shop purchase state
      setShopUpgrades((prev) => {
        const next = { ...prev };
        if (itemId === 'speed_5') next.timeSpeedLimit = Math.max(next.timeSpeedLimit, 5);
        if (itemId === 'speed_10') next.timeSpeedLimit = Math.max(next.timeSpeedLimit, 10);
        if (itemId === 'speed_120') next.timeSpeedLimit = Math.max(next.timeSpeedLimit, 120);
        
        if (itemId === 'gold_1_5') next.goldRateLimit = Math.max(next.goldRateLimit, 1.5);
        if (itemId === 'gold_2_5') next.goldRateLimit = Math.max(next.goldRateLimit, 2.5);
        if (itemId === 'gold_5_0') next.goldRateLimit = Math.max(next.goldRateLimit, 5.0);
        
        if (itemId === 'wings') next.auroraWings = true;
        if (itemId === 'crown') next.steamCrown = true;
        
        return next;
      });

      showToast(`🎁 상점 장비 물품 전수 계약 완료! 수혜가 활성화되었습니다.`, 'success');
      await triggerSyncAndAchievementsCheck();
    } catch (err: any) {
      console.error('Shop purchase failed:', err);
      showToast('상점 계약 성문화 중 신비로운 전송 저항 발생: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Equip unlocked title
  const handleEquipTitle = async (title: string) => {
    if (!currentUser || !currentProfile) return;
    try {
      setProfileSaving(true);
      const upProfile = await DBProvider.updateProfile(currentUser.id, { selected_title: title });
      setCurrentProfile(upProfile);
    } catch (err) {
      console.error('Title equip failure:', err);
    } finally {
      setProfileSaving(false);
    }
  };

  // Change Profile Nickname
  const handleUpdateNicknameSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentProfile || !newNickname.trim()) return;

    try {
      setProfileSaving(true);
      const updated = await DBProvider.updateProfile(currentUser.id, { nickname: newNickname.trim() });
      setCurrentProfile(updated);
      showToast('닉네임이 성공적으로 변경되었습니다!', 'success');
    } catch (err: any) {
      showToast('닉네임 변경에 실패하였습니다: ' + err.message, 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  // Formatting stopwatch HH:MM:SS
  const formatTime = (totalSecs: number) => {
    if (typeof totalSecs !== 'number' || isNaN(totalSecs) || totalSecs < 0) {
      return '00:00:00';
    }
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const hrsStr = String(hrs).padStart(2, '0');
    const minsStr = String(mins).padStart(2, '0');
    const secsStr = String(secs).padStart(2, '0');

    return `${hrsStr}:${minsStr}:${secsStr}`;
  };

  // Translate minutes into human-readable hours & minutes
  const formatMinutesReadable = (totalMins: number) => {
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs === 0) return `${mins}분`;
    return `${hrs}시간 ${mins}분`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans transition-all selection:bg-amber-400 selection:text-slate-900">
      
      {/* Custom Toast Notification Overlay */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-4 sm:right-6 lg:right-8 z-50 max-w-sm w-80 sm:w-96 bg-slate-900/95 border border-slate-705 p-4 rounded-xl shadow-2xl flex items-start gap-3 backdrop-blur-md"
          >
            <div className={`p-1.5 rounded-lg border flex-shrink-0 ${
              toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
              toast.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
              'bg-blue-500/10 border-blue-500/20 text-blue-400'
            }`}>
              {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <Info className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-100 leading-snug">
                {toast.message}
              </p>
            </div>
            <button 
              onClick={() => setToast(null)}
              className="text-slate-500 hover:text-slate-300 font-bold cursor-pointer text-xs flex-shrink-0 px-1"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header navigation */}
      <header className="bg-slate-800/80 border-b border-slate-700/80 sticky top-0 z-40 backdrop-blur-md shadow-lg transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
          
          {/* Logo with swords and coins */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="bg-amber-500 text-slate-950 p-2 rounded-lg glow-gold animate-pulse">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h1 className={`text-lg font-extrabold tracking-tight font-display transition-colors ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                스피지 <span className="text-amber-400">SPG</span>
              </h1>
              <p className="text-[10px] text-slate-400 -mt-0.5 tracking-wider font-mono">STUDY + RPG 게이밍 타이머</p>
            </div>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              title={theme === 'light' ? '다크 모드(밤)로 전환' : '라이트 모드(낮)로 전환'}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95 ${
                theme === 'light'
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-600 border-amber-200'
                  : 'bg-slate-800/80 hover:bg-slate-750 text-amber-400 border-slate-700/80 glow-gold'
              }`}
            >
              {theme === 'light' ? (
                <div className="flex items-center gap-1.5 px-0.5">
                  <Sun className="w-4 h-4 text-amber-500 animate-spin" style={{ animationDuration: '20s' }} />
                  <span className="text-[10px] font-bold hidden sm:inline-block">낮 모드</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-0.5">
                  <Moon className="w-4 h-4 text-indigo-300 animate-pulse" />
                  <span className="text-[10px] font-bold hidden sm:inline-block">밤 모드</span>
                </div>
              )}
            </button>

            {/* User state or logs */}
            {currentUser && currentProfile && (
              <div className="flex items-center gap-3 sm:gap-6">
                
                {/* Character miniature info */}
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-semibold text-slate-200 flex items-center justify-end gap-1.5">
                    {currentUser?.email === 'seungki611@gmail.com' && (
                      <span className="bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 text-white font-black text-[9px] px-2 py-0.5 rounded shadow glow-gold border border-pink-400/20 uppercase tracking-wider animate-pulse">
                        개발자 GM 🛠️
                      </span>
                    )}
                    <span className="bg-indigo-500/10 text-indigo-300 font-mono text-[9px] px-1.5 py-0.5 rounded border border-indigo-400/20">
                      {currentProfile.selected_title || '첫걸음 학습자'}
                    </span>
                    {currentProfile.nickname} 님
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {currentUser?.email === 'seungki611@gmail.com' ? '👑 시스템 총괄 관리주체' : '학습 레벨 게이머'}
                  </span>
                </div>

                {/* Coins counter widget */}
                <div className="bg-slate-950 border border-slate-700/80 bg-opacity-40 rounded-full py-1 px-3 flex items-center gap-1.5 glow-gold">
                  <Coins className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '3s' }} />
                  <span className="text-amber-300 font-mono text-xs font-bold">
                    {currentProfile.coins.toLocaleString()}
                  </span>
                  <span className="text-amber-400/80 text-[10px] font-bold">🪙</span>
                </div>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  title="로그아웃"
                  className="text-slate-400 hover:text-red-400 p-1.5 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                >
                  <LogOut className="w-4.5 h-4.5" />
                </button>

              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container workspace */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        
        {loading && (
          <div className="flex-grow flex flex-col items-center justify-center py-20 min-h-[400px]">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-400 text-sm font-mono animate-pulse">모듈 데이터를 동기화하는 중...</p>
          </div>
        )}

        {!loading && !currentUser && (
          /* Authentication Screen (Unauthenticated) */
          <div className="max-w-md w-full mx-auto my-auto flex flex-col py-10">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-6 sm:p-8 shadow-2xl relative"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600" />
              
              <div className="text-center mb-6">
                <div className="inline-flex bg-amber-500/10 p-4 rounded-full text-amber-400 mb-3 border border-amber-500/20">
                  <Trophy className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold font-display text-white">스피지 (SPG) 모험가 길드 입장</h2>
                <p className="text-xs text-slate-400 mt-1">
                  공부 시간(STUDY)과 성장 요소(RPG)의 만남! 오늘의 공부량을 코인으로 전환하여 보스를 무찌르는 영웅이 되어보세요.
                </p>
              </div>

              {/* Login/Signup Tabs */}
              <div className="flex bg-slate-950 p-1 rounded-xl mb-6 border border-slate-800">
                <button
                  type="button"
                  onClick={() => { setAuthTab('login'); setAuthError(null); }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    authTab === 'login' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  로그인
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthTab('register'); setAuthError(null); }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    authTab === 'register' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  회원가입
                </button>
              </div>

              {authError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-4 mb-5 font-medium space-y-3">
                  <div>⚠️ {authError}</div>
                  
                  {/* Smart bypass helper for email confirmation and rate limits */}
                  {(authError.toLowerCase().includes('limit') || 
                    authError.toLowerCase().includes('confirm') || 
                    authError.toLowerCase().includes('실패') || 
                    authError.toLowerCase().includes('not confirmed') ||
                    true) && (
                    <div className="pt-2.5 border-t border-red-500/20 text-slate-300 font-normal leading-relaxed text-[11px] space-y-2">
                      <p>
                        💡 <strong>Supabase 서버 한도 초과 또는 이메일 인증(Confirm) 대기 현상입니다.</strong>
                        <br />
                        서버 가입을 건너뛰고 내 브라우저 저장소([로컬전용 모드])를 이용하면 즉석에서 막힘없이 모험가 계정을 생성하고 모든 타이머, 공부 보상 코인 퀘스트, 도감을 즐기실 수 있습니다!
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            localStorage.setItem('quest_force_local_mode', 'true');
                            setIsSupabaseMode(false);
                            setAuthError(null);
                            
                            // Immediately create local storage-based randomized guest
                            const guestRand = Math.floor(100 + Math.random() * 900);
                            const guestEmail = `local_user_${guestRand}@coinquest.local`;
                            const guestPassword = `pwd_${guestRand}`;
                            const guestNickname = `로컬모험가 ${guestRand}`;
                            
                            setLoading(true);
                            const user = await DBProvider.signUp(guestEmail, guestPassword, guestNickname);
                            setCurrentUser(user);
                            showToast('💾 즉시 로컬 단독 기억 모드로 전환 및 로그인이 완료되었습니다!', 'success');
                          } catch (e: any) {
                            setAuthError('로컬 모드 가입 전환 중 오류: ' + e.message);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        className="w-full bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-black py-2 px-3 rounded-lg cursor-pointer transition-all active:scale-[0.98] shadow-md text-center block text-[11px]"
                      >
                        ⚙️ 안전한 로컬 저장소 모드로 즉시 강제 전환 + 바로 로그인 시작하기
                      </button>
                    </div>
                  )}
                </div>
              )}

              {authSuccessMsg && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl p-3 mb-5 font-medium">
                  🎉 {authSuccessMsg}
                </div>
              )}

              {/* Standard Auth Form */}
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase font-mono tracking-wider">이메일 주소</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase font-mono tracking-wider">비밀번호</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="flex items-center justify-between py-1 px-1 select-none">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-450 hover:text-slate-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                    />
                    <span>🛡️ 로그인 신원 기록 보존하기 (자동 채우기)</span>
                  </label>
                </div>

                {authTab === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase font-mono tracking-wider font-display">사용할 닉네임</label>
                    <input
                      type="text"
                      required
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="예: 독서실정복자"
                      maxLength={15}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm py-3 rounded-xl cursor-pointer transition-colors shadow-lg active:scale-[0.99] duration-150"
                >
                  {authTab === 'login' ? '모험 시작 (길드 로그인)' : '새로운 용사 등록 (길드 가입)'}
                </button>
              </form>

              {/* Quick Guest Experience Onboarding helper */}
              <div className="mt-6 pt-6 border-t border-slate-800">
                <p className="text-[11px] text-slate-500 text-center mb-3">
                  번거로운 가입 절차 없이 바로 모험을 즉석에서 즐겨보실까요?
                </p>
                <button
                  type="button"
                  onClick={handleQuickGuestOnboarding}
                  className="w-full flex items-center justify-center gap-1.5 bg-slate-950 hover:bg-slate-850 text-amber-400 hover:text-amber-300 border border-amber-500/20 py-2.5 px-4 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md"
                >
                  <Sparkles className="w-4 h-4" />
                  💡 게스트 모험가로 바로 시작하기 (로컬 신속 체험)
                </button>
              </div>

            </motion.div>
          </div>
        )}

        {!loading && currentUser && currentProfile && (
          /* Main Application Dashboard Panel */
          <div className="flex flex-col gap-6">
            
            {/* Nav Menu Tabs bar */}
            <div className="flex select-none bg-slate-800/55 border border-slate-700/80 p-1.5 rounded-2xl justify-between sm:justify-start gap-1 overflow-x-auto shadow-lg backdrop-blur-md transition-all duration-300">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 py-2.5 px-3.5 sm:px-5 rounded-xl text-xs font-bold font-display tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'dashboard'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Clock className="w-4 h-4" />
                모험 대시보드 (타이머)
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 py-2.5 px-3.5 sm:px-5 rounded-xl text-xs font-bold font-display tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'history'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <History className="w-4 h-4" />
                학습 수행 기록
              </button>

              <button
                onClick={() => setActiveTab('achievements')}
                className={`flex items-center gap-2 py-2.5 px-3.5 sm:px-5 rounded-xl text-xs font-bold font-display tracking-wide transition-all cursor-pointer relative whitespace-nowrap ${
                  activeTab === 'achievements'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Award className="w-4 h-4" />
                수문장 보스 처단
                {achievements.length < ACHIEVEMENTS.length && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('rankings')}
                className={`flex items-center gap-2 py-2.5 px-3.5 sm:px-5 rounded-xl text-xs font-bold font-display tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'rankings'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Trophy className="w-4 h-4" />
                명예의 전당 (랭킹)
              </button>

              <button
                id="nav_profile"
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-2 py-2.5 px-3.5 sm:px-5 rounded-xl text-xs font-bold font-display tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'profile'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <User className="w-4 h-4" />
                모험가 설정 & 칭호
              </button>

              <button
                id="nav_shop"
                onClick={() => setActiveTab('shop')}
                className={`flex items-center gap-2 py-2.5 px-3.5 sm:px-5 rounded-xl text-xs font-bold font-display tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'shop'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/10 border border-amber-400/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Store className="w-4 h-4" />
                🏪 길드 상점 (Shop)
              </button>
            </div>

            {/* Container for Tab panels */}
            <div className="min-h-[450px]">
              <AnimatePresence mode="wait">
                
                {/* 1. DASHBOARD PANEL */}
                {activeTab === 'dashboard' && (
                  <motion.div
                    key="dashboard"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch"
                  >
                    
                    {/* Bento Card 2: Main Timer (Stopwatch Panel) */}
                    <div className="col-span-12 lg:col-span-6 bg-slate-900/60 border-2 border-slate-700/80 rounded-[2.5rem] p-6 sm:p-8 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl backdrop-blur-md">
                      
                      {/* Active session indicators */}
                      <div className="absolute top-6 left-6 flex items-center gap-2 bg-slate-950/60 px-4 py-2 rounded-full border border-slate-800">
                        <span className={`w-2 h-2 rounded-full ${isTimerRunning ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`}>●</span>
                        <span className="text-[10px] font-black tracking-widest uppercase text-slate-300 font-mono">
                          {isTimerRunning ? '⚔️ 공부 퀘스트 수행 중' : '💤 거점 대기 상태'}
                        </span>
                      </div>

                      <div className="absolute top-6 right-6 flex items-center gap-1.5 bg-slate-950/60 px-3 py-1.5 rounded-full border border-slate-800 text-[10px] text-slate-400 font-mono">
                        {isTimerRunning ? (cheatSpeedEnabled ? '⏩ 60배속 비상 게이지 가속' : '⏱️ 실시간 시간 축적') : '출격 대기'}
                      </div>

                      {/* Top buffer space */}
                      <div className="h-6 w-full" />

                      {/* Selected Evolved Avatar display inside Timer pane (SUPERSIZED) */}
                      {(() => {
                        const currentAvatar = AVATARS.find(a => a.key === selectedAvatarKey) || AVATARS[0];
                        const avatarStageIdx = getEvolutionStageIndex(achievements.length);
                        const currentStage = currentAvatar.stages[avatarStageIdx] || currentAvatar.stages[0];
                        const auraWingsActive = shopUpgrades.auroraWings;
                        const steamCrownActive = shopUpgrades.steamCrown;

                        return (
                          <div className="flex flex-col items-center gap-3.5 bg-slate-950/80 p-5 rounded-[2rem] border-2 border-indigo-500/20 w-full max-w-sm my-3.5 relative overflow-hidden group shadow-xl">
                            {/* Theme backdrop glow */}
                            <div className={`absolute -inset-10 bg-gradient-to-tr ${currentAvatar.themeColor} opacity-[0.12] blur-xl group-hover:scale-110 transition-all duration-500`} />
                            
                            {/* Aurora wings animation backdrop */}
                            {auraWingsActive && (
                              <div className="absolute inset-y-0 w-full flex justify-between items-center px-6 pointer-events-none z-0">
                                <span className="text-4xl animate-[pulse_1.5s_infinite] select-none text-fuchsia-400">🦋</span>
                                <span className="text-4xl animate-[pulse_1.5s_infinite] select-none text-sky-400">🦋</span>
                              </div>
                            )}

                            {/* Main Avatar Character - STUNNINGLY LARGE */}
                            <div className="relative">
                              {/* Steam Crown floating above character */}
                              {steamCrownActive && (
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl select-none animate-[bounce_1.8s_infinite] drop-shadow-[0_4px_8px_rgba(251,191,36,0.6)] z-10">
                                  👑
                                </div>
                              )}

                              <div className={`w-28 h-28 rounded-full flex items-center justify-center bg-gradient-to-br ${currentAvatar.themeColor} text-5xl shadow-lg border-4 border-white/20 shrink-0 transform transition-transform group-hover:scale-105 duration-300 relative z-10 animate-[bounce_4s_infinite]`}>
                                {currentStage.emoji}
                                {/* Active status pulse shield */}
                                <span className={`absolute inset-0 rounded-full border-2 ${isTimerRunning ? 'border-red-500 animate-ping opacity-60' : 'border-indigo-400/30 animate-pulse'}`} />
                              </div>
                            </div>

                            <div className="text-center relative z-10 w-full">
                              <div className="flex items-center justify-center gap-1 mb-1">
                                <span className="text-[9px] font-black text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-400/20 font-mono">
                                  STAGE {currentStage.stage}
                                </span>
                                <span className="text-[9px] font-black text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/20">
                                  진화 수호수
                                </span>
                              </div>
                              <h4 className="text-white font-extrabold text-sm tracking-tight">
                                {currentStage.name}
                              </h4>
                              <p className="text-[10px] text-slate-400 italic mt-1 leading-normal max-w-[280px] mx-auto truncate">
                                "{currentStage.description}"
                              </p>
                              
                              {/* Live companion voice bubble depending on timer state */}
                              <div className="mt-2.5 bg-slate-900/90 border border-slate-805 rounded-xl py-1.5 px-3 text-[10px] text-slate-355 shadow-md">
                                <span className="text-indigo-400 font-extrabold mr-1">{currentAvatar.name.split(' ')[1] || '레온'}:</span>
                                <span>
                                  {isTimerRunning 
                                    ? `공부 배속 ${timeSpeedMultiplier}배 집중 중! 보스 정벌까지 남은 체력을 집중하삼!`
                                    : `출진 준비 끝! 새로운 집중 전투 기록을 개시하십시오!`
                                  }
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Giant digital timer display */}
                      <div className="text-[5.5rem] sm:text-[7rem] md:text-[8rem] font-black leading-none tracking-tighter text-indigo-400 drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] my-5 font-mono flex items-center justify-center selection:bg-indigo-600/55 select-none">
                        {isTimerRunning ? formatTime(elapsedSeconds) : '00:00:00'}
                      </div>

                      {/* Active Rush indicators */}
                      {(coinRushRemaining > 0 || timeRushRemaining > 0) && (
                        <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                          {coinRushRemaining > 0 && (
                            <motion.div
                              animate={{ scale: [1, 1.05, 1] }}
                              transition={{ repeat: Infinity, duration: 2 }}
                              className="bg-amber-500/15 border-2 border-amber-500/35 text-amber-400 font-extrabold text-[11px] px-3 py-1 rounded-full flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-mono"
                            >
                              <span className="animate-spin text-xs" style={{ animationDuration: '3s' }}>🪙</span>
                              <span>코인 러쉬: 3배 수확 중!</span>
                              <span className="bg-slate-950 px-1.5 py-0.5 rounded text-[10px] text-slate-350 shrink-0">
                                {Math.floor(coinRushRemaining / 60)}분 {String(coinRushRemaining % 60).padStart(2, '0')}초
                              </span>
                            </motion.div>
                          )}
                          {timeRushRemaining > 0 && (
                            <motion.div
                              animate={{ scale: [1, 1.05, 1] }}
                              transition={{ repeat: Infinity, duration: 1.5 }}
                              className="bg-purple-500/15 border-2 border-purple-500/35 text-purple-400 font-extrabold text-[11px] px-3 py-1 rounded-full flex items-center gap-1.5 shadow-[0_0_12px_rgba(168,85,247,0.2)] font-mono"
                            >
                              <span className="animate-pulse text-xs">⚡</span>
                              <span>시간 러쉬: 120배 가속 중!</span>
                              <span className="bg-slate-950 px-1.5 py-0.5 rounded text-[10px] text-slate-350 shrink-0">
                                {Math.floor(timeRushRemaining / 60)}분 {String(timeRushRemaining % 60).padStart(2, '0')}초
                              </span>
                            </motion.div>
                          )}
                        </div>
                      )}

                      {/* Multiplier controller bento */}
                      <div className="w-full max-w-sm bg-slate-950/70 p-4 rounded-3xl border border-slate-800/80 my-3 text-xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-slate-400 font-bold font-mono text-[10px] uppercase tracking-wider flex items-center gap-1">
                            ⚡ 집중 전장 배속 설정기
                          </span>
                          <span className="text-indigo-400 font-bold font-mono text-[11px]">
                            현재 {timeSpeedMultiplier}배속 {isTimerRunning && '(적용 중)'}
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-1.5 select-none">
                          {[1, 5, 10, 120].map((spd) => {
                            const isSelected = timeSpeedMultiplier === spd;
                            const isLocked = spd > shopUpgrades.timeSpeedLimit;

                            return (
                              <button
                                key={spd}
                                type="button"
                                disabled={isTimerRunning}
                                onClick={() => {
                                  if (isLocked) {
                                    showToast(`🏪 상점에서 전설의 가속의 모음서를 골드로 구매하면 최대 ${spd}배속 가속 혜택이 영구 잠금해제됩니다!`, 'info');
                                  } else {
                                    setTimeSpeedMultiplier(spd);
                                    showToast(`⚡ 시간 가속율이 ${spd}배속으로 성공적으로 조율되었습니다!`, 'success');
                                  }
                                }}
                                className={`py-1.5 px-1 rounded-xl text-center font-bold font-mono text-[11px] truncate flex flex-col items-center justify-center relative cursor-pointer border transition-all ${
                                  isLocked 
                                    ? 'bg-slate-950/40 border-slate-900 border-dashed text-slate-600'
                                    : isSelected
                                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-md font-extrabold'
                                      : 'bg-slate-900 border-slate-850 hover:bg-slate-800 text-slate-400'
                                } ${isTimerRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <span className={isSelected ? 'text-white' : 'text-slate-350'}>{spd}x</span>
                                {isLocked && <span className="text-[8px] text-amber-500 font-bold">🔒 Lock</span>}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[9.5px] text-slate-500 mt-2 font-mono leading-relaxed text-center">
                          * 모래시계 레벨이 높을수록 타이머 눈금이 가속 축적됩니다. {isTimerRunning && '집중 진행 중에는 배속을 임의 조정할 수 없습니다.'}
                        </p>
                      </div>

                      <p className="text-slate-400 font-bold mb-8 uppercase tracking-[0.25em] text-xs opacity-90 text-center font-display">
                        수행 중인 집중 토벌 시간
                      </p>

                      <div className="flex gap-4 w-full max-w-sm">
                        {!isTimerRunning ? (
                          <button
                            type="button"
                            onClick={handleStartTimer}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white h-16 sm:h-20 rounded-2xl font-black text-sm sm:text-lg shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border border-transparent"
                          >
                            <Play className="w-5 h-5 fill-current text-white" />
                            ⚔️ 집중 모험 개시
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleStopTimer}
                            className="flex-1 bg-rose-600 hover:bg-rose-500 text-white h-16 sm:h-20 rounded-2xl font-black text-sm sm:text-lg shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border border-transparent animate-pulse"
                          >
                            <Square className="w-5 h-5 fill-current text-white" />
                            🛡️ 보스 공략 완료 (골드 획득)
                          </button>
                        )}
                      </div>

                      {/* Co-Study Live Group Display */}
                      {isTimerRunning && (
                        <div className="w-full mt-5 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/80 animate-fade-in w-full max-w-sm">
                          <div className="flex items-center gap-1.5 mb-2.5">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-bounce"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                            </span>
                            <h4 className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest font-mono">
                              ⚔️ 실시간 동행 집중 수련단 (Co-Study Network)
                            </h4>
                          </div>

                          <div className="space-y-2">
                            {(() => {
                              const peers = adminUserList.filter(u => u.id !== currentUser?.id);
                              
                              if (peers.length === 0) {
                                const defaultPeers = [
                                  { nickname: '새벽의 현자 아르곤', title: '우주 수호대장', avatarKey: 'geargar' },
                                  { nickname: '집중요정 벨', title: '평화의 치유사', avatarKey: 'elphris' }
                                ];
                                return defaultPeers.map((dp, idx) => {
                                  const av = AVATARS.find(a => a.key === dp.avatarKey) || AVATARS[0];
                                  const st = av.stages[1];
                                  const simulatedSpent = elapsedSeconds + (idx * 153) + 45;
                                  return (
                                    <div key={idx} className="flex items-center gap-2.5 bg-slate-900/60 p-2 rounded-xl border border-slate-850">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br ${av.themeColor} text-lg shadow-inner`}>
                                        {st.emoji}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-bold text-slate-200 truncate">{dp.nickname}</p>
                                        <span className="text-[8px] text-slate-500 font-medium font-mono">ST.{st.stage} {st.name}</span>
                                      </div>
                                      <div className="text-right">
                                        <span className="text-[9.5px] font-extrabold text-indigo-400 font-mono block">
                                          {formatTime(simulatedSpent)}
                                        </span>
                                        <span className="text-[8px] text-emerald-400 font-bold block">🔥 집중 중</span>
                                      </div>
                                    </div>
                                  );
                                });
                              }

                              return peers.slice(0, 2).map((peer, idx) => {
                                const peerTitle = peer.selected_title || '첫걸음 학습자';
                                const peerAvatarKeys = ['luna', 'geargar', 'elphris', 'leon'];
                                const assignedKey = peerAvatarKeys[idx % peerAvatarKeys.length];
                                const av = AVATARS.find(a => a.key === assignedKey) || AVATARS[0];
                                const peerStageIdx = getEvolutionStageIndex(peer.session_count || 1);
                                const st = av.stages[peerStageIdx] || av.stages[0];
                                const simulatedSpent = elapsedSeconds + (idx * 312) + 120;

                                return (
                                  <div key={peer.id} className="flex items-center gap-2.5 bg-slate-900/60 p-2 rounded-xl border border-slate-850">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br ${av.themeColor} text-lg shadow-inner`}>
                                      {st.emoji}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1">
                                        <p className="text-[10px] font-bold text-slate-200 truncate">{peer.nickname}</p>
                                        <span className="text-[8px] text-amber-500 font-black">[{peerTitle}]</span>
                                      </div>
                                      <span className="text-[8px] text-slate-500 font-medium font-mono">ST.{st.stage} {st.name}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[9.5px] font-extrabold text-indigo-400 font-mono block">
                                        {formatTime(simulatedSpent)}
                                      </span>
                                      <span className="text-[8px] text-amber-400 font-bold block">🗡️ 동행 중</span>
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}

                      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
                    </div>

                    {/* Bento Card 3: Today's Progress & Streak tracker */}
                    <div className="col-span-12 md:col-span-8 lg:col-span-3 bg-slate-800/40 border border-slate-700/80 rounded-[2rem] p-6 flex flex-col justify-between shadow-xl relative overflow-hidden backdrop-blur-md">
                      <div>
                        <h3 className="text-slate-400 font-bold uppercase text-xs tracking-widest font-mono">오늘의 일일 퀘스트 목표</h3>
                        
                        <div className="space-y-4 mt-6">
                          <div>
                            <div className="flex justify-between text-xs mb-1.5 font-extrabold text-slate-300 font-mono">
                              <span>일일 집중 과제 (10분)</span>
                              <span className="text-blue-400">{stats.todayPercent}%</span>
                            </div>
                            <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-300"
                                style={{ width: `${stats.todayPercent}%` }}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-center pt-2">
                            <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
                              <p className="text-[10px] text-slate-500 font-bold uppercase font-mono">오늘의 사냥 성과</p>
                              <p className="font-extrabold text-xs text-slate-200 mt-0.5 font-mono">{stats.todayTotalMinutes}분</p>
                            </div>
                            <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
                              <p className="text-[10px] text-slate-500 font-bold uppercase font-mono">일일 출석 보상</p>
                              <p className={`font-extrabold text-xs mt-0.5 ${stats.todayStudied ? 'text-emerald-400' : 'text-orange-400'}`}>
                                {stats.todayStudied ? '수령 완료! 🎉' : '진행 대기 중'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Continuous Streak Fire Box */}
                      <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 text-center mt-6">
                        <div className="text-5xl mb-1.5 select-none animate-bounce" style={{ animationDuration: '3s' }}>🔥</div>
                        <div className="text-3xl font-black text-orange-500 font-display">
                          {stats.streak}일 연속
                        </div>
                        <p className="text-[10px] font-black uppercase text-orange-400 tracking-wider font-mono">
                          연속 모험 성공 (피버 스트릭)
                        </p>
                      </div>
                    </div>

                    {/* Bento Cards 4-7: The 4 Metric telemetry tiles */}
                    <div className="col-span-12 md:col-span-3 bg-slate-800/40 border border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between shadow-md hover:border-indigo-500/30 transition-all backdrop-blur-md">
                      <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider font-display">오늘의 사냥 시간</span>
                      <span className="text-xl font-black text-white mt-3 font-display flex items-center gap-1.5 font-mono">
                        <Clock className="w-4 h-4 text-indigo-400" />
                        {formatMinutesReadable(stats.todayMin)}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1 font-mono">오늘 총 집중 수련 시간</span>
                    </div>

                    <div className="col-span-12 md:col-span-3 bg-slate-800/40 border border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between shadow-md hover:border-emerald-500/30 transition-all backdrop-blur-md">
                      <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider font-display">주간 전투 공적치</span>
                      <span className="text-xl font-black text-white mt-3 font-display flex items-center gap-1.5 font-mono">
                        <BookOpen className="w-4 h-4 text-emerald-400" />
                        {formatMinutesReadable(stats.weekMin)}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1 font-mono">이번 주 총 토벌 공헌 시간</span>
                    </div>

                    <div className="col-span-12 md:col-span-3 bg-slate-800/40 border border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between shadow-md hover:border-rose-500/30 transition-all backdrop-blur-md">
                      <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider font-display">월간 전투 누적</span>
                      <span className="text-xl font-black text-white mt-3 font-display flex items-center gap-1.5 font-mono">
                        <TrendingUp className="w-4 h-4 text-rose-400" />
                        {formatMinutesReadable(stats.monthMin)}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1 font-mono">이번 달 총 집중 모험 시간</span>
                    </div>

                    <div className="col-span-12 md:col-span-3 bg-slate-800/40 border border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between shadow-md hover:border-amber-500/30 transition-all backdrop-blur-md">
                      <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider font-display">총 누적 전투 전적</span>
                      <span className="text-xl font-black text-white mt-3 font-display flex items-center gap-1.5 font-mono">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        {formatMinutesReadable(stats.totalMin)}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1 font-mono">모험을 시작한 이래 축적한 총 시간</span>
                    </div>

                    {/* Bento Card 1: User Profile & Character Display */}
                    <div className="col-span-12 md:col-span-4 lg:col-span-3 bg-slate-800/40 border border-slate-700/80 rounded-[2rem] p-6 flex flex-col justify-between shadow-xl relative overflow-hidden backdrop-blur-md">
                       <div className="absolute top-0 right-0 p-8 opacity-5 text-indigo-400 pointer-events-none">
                        <Shield className="w-36 h-36" />
                      </div>
                      <div>
                        {/* Dynamic Evolving Companion Avatar Slot */}
                        <div className="flex items-center gap-3.5 mb-5 group cursor-pointer select-none" onClick={() => setActiveTab('profile')}>
                          <div className={`w-16 h-16 bg-gradient-to-br ${activeAvatarDef.definition.themeColor} rounded-2xl flex items-center justify-center text-4xl shadow-xl border border-white/10 transform transition-transform group-hover:scale-105 group-hover:rotate-3 duration-500`}>
                            {activeAvatarDef.stage.emoji}
                          </div>
                          <div>
                            <span className="text-[9px] bg-slate-950 text-indigo-400 font-black px-2 py-0.5 rounded-full border border-indigo-500/20 font-mono uppercase tracking-wider">
                              Stage {activeAvatarDef.stageIndex} Evolution
                            </span>
                            <div className="text-sm font-black text-white font-display mt-0.5 group-hover:text-indigo-400 transition-colors">
                              {activeAvatarDef.stage.name}
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium">장착 파트너: {activeAvatarDef.definition.name}</p>
                          </div>
                        </div>

                        <h2 className="text-2xl font-extrabold tracking-tight text-white font-display">
                          {currentProfile.nickname} 용사님
                        </h2>
                        <p className="text-indigo-400 font-bold text-sm tracking-wide flex items-center gap-1.5 uppercase mt-1 font-display">
                          <Award className="w-4 h-4 text-amber-500" />
                          {currentProfile.selected_title || '첫걸음 학습자'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/60 mt-6 md:mt-8">
                        <div className="text-amber-400 text-3xl select-none animate-spin" style={{ animationDuration: '6s' }}>🪙</div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">보유 골드 재화</p>
                          <p className="text-xl font-black text-amber-400 font-mono">
                            {currentProfile.coins.toLocaleString()} <span className="text-xs font-semibold">골드</span>
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs border-t border-slate-800/65 pt-4 mt-4">
                        <div className="flex justify-between">
                          <span className="text-slate-400">완료된 사냥 세션:</span>
                          <span className="text-slate-200 font-mono font-bold">{studySessions.length}회 격파</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">물리친 수문장 보스:</span>
                          <span className="text-indigo-300 font-bold">{achievements.length} / {ACHIEVEMENTS.length}마리 처단</span>
                        </div>
                      </div>
                    </div>

                    {/* Bento Card 8: Boss Quest Battle Status */}
                    <div className={`col-span-12 ${currentUser?.email === 'seungki611@gmail.com' ? 'lg:col-span-8' : 'lg:col-span-9'} bg-slate-900/60 border-2 border-slate-700/80 rounded-[2.5rem] p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 sm:gap-8 relative overflow-hidden shadow-2xl backdrop-blur-md`}>
                      <div className="absolute inset-0 bg-red-500/5 pointer-events-none" />
                      <div className="w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0 bg-red-955/40 rounded-full flex items-center justify-center text-5xl shadow-[0_0_50px_rgba(239,68,68,0.25)] select-none animate-pulse border border-red-500/10">
                        {currentBoss.key === 'first_study' ? '🦠' : 
                         currentBoss.key === 'focus_beginner' ? '🗿' : 
                         currentBoss.key === 'study_warrior' ? '👿' : 
                         currentBoss.key === 'midterm_boss' ? '🐲' : 
                         currentBoss.key === 'final_boss' ? '⚔️' : 
                         currentBoss.key === 'csat_boss' ? '🔮' : '🏛️'}
                      </div>
                      <div className="flex-1 w-full relative z-10">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-3 gap-2">
                          <div>
                            <p className="text-red-500 font-black text-xs uppercase tracking-widest mb-1 font-mono">⚔️ 현재 무찌르는 중인 전방의 수문장</p>
                            <h3 className="text-2xl sm:text-3xl font-black text-white italic underline underline-offset-4 decoration-red-600 font-display flex items-center gap-2">
                              {currentBoss.bossName}
                            </h3>
                          </div>
                          <p className="text-lg font-black text-white font-mono">
                            {(stats.totalMin / 60).toFixed(1)} / <span className="text-slate-500">{currentBoss.requiredHours}시간 수련</span>
                          </p>
                        </div>
                        <div className="h-4 w-full bg-slate-950 rounded-full p-1 border border-slate-800">
                          <div
                            className="h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full shadow-[0_0_12px_rgba(239,68,68,0.6)]"
                            style={{ width: `${Math.min(100, Math.floor(((stats.totalMin / 60) / (currentBoss.requiredHours || 1)) * 100))}%` }}
                          />
                        </div>
                        <p className="mt-3 text-xs text-slate-400 font-medium leading-relaxed">
                          🎯 {currentBoss.description} <br />
                          누적 {currentBoss.requiredHours}시간 집중 달성 시 보스 정복 완료! 수문장 처치 수확물로 <span className="text-amber-400 font-bold font-mono">+{currentBoss.rewardCoins} 골드(🪙)</span> 지급 및 명예로운 <span className="text-indigo-400 font-bold font-display">"[{currentBoss.rewardTitle}]"</span> 칭호 왕관을 영구 잠금 해제합니다.
                        </p>
                      </div>
                    </div>

                    {/* Bento Card 9: Comprehensive Administrator Directory & Reward Center */}
                    {currentUser?.email === 'seungki611@gmail.com' && (
                      <div className="col-span-12 lg:col-span-4 bg-slate-900/35 border border-slate-800 rounded-[2rem] p-5 shadow-xl relative overflow-hidden backdrop-blur-md font-sans">
                        <div className="flex items-center gap-1.5 text-rose-450 font-display mb-3.5">
                          <Sliders className="w-4 h-4 text-rose-400" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-rose-400">🛡️ 시스템 관리자: 전체 모험가 정보조회 및 보상소</h4>
                        </div>

                        <div className="space-y-3.5 text-xs">
                          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-[10px] text-slate-400 leading-relaxed uppercase font-mono">
                            💡 master administration panel: query users, inject progress, grant coin/time rush boons.
                          </div>

                          {/* Search / selection inputs */}
                          <div className="space-y-2">
                            <label className="text-[11px] text-slate-400 font-bold block">🧙‍♂️ 대상 모험가 선택 및 검색</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="🔍 모험가 이름 검색..."
                                value={adminUserSearchQuery}
                                onChange={(e) => setAdminUserSearchQuery(e.target.value)}
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-sans"
                              />
                              {adminUserSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setAdminUserSearchQuery('')}
                                  className="px-2.5 bg-slate-800 hover:bg-slate-705 border border-slate-720 text-slate-300 rounded-lg text-xs cursor-pointer whitespace-nowrap"
                                >
                                  초기화
                                </button>
                              )}
                            </div>
                            <select
                              value={selectedAdminId}
                              onChange={(e) => setSelectedAdminId(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                            >
                              {(() => {
                                const filteredList = adminUserList.filter(u => 
                                  u.nickname.toLowerCase().includes(adminUserSearchQuery.toLowerCase())
                                );
                                return (
                                  <>
                                    <option value="">
                                      -- 모험가를 선택하십시오 ({filteredList.length}명 검색됨) --
                                    </option>
                                    {filteredList.map(u => (
                                      <option key={u.id} value={u.id}>
                                        {u.nickname} ({u.id.substring(0, 6)}...) - {Math.round(u.total_minutes / 60)}시간 수련 / {u.coins.toLocaleString()}골드
                                      </option>
                                    ))}
                                  </>
                                );
                              })()}
                            </select>
                          </div>

                          {selectedAdminId && (() => {
                            const tgUser = adminUserList.find(u => u.id === selectedAdminId);
                            if (!tgUser) return null;

                            return (
                              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-850 text-[11px] space-y-2.5 font-sans">
                                {/* Read statistics */}
                                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                  <div className="bg-slate-900/40 p-2 rounded border border-slate-800/60 font-sans">
                                    <span className="text-slate-500 block text-[9px] uppercase font-bold">누적 전투시간 / 횟수</span>
                                    <span className="text-white font-black font-mono">{Math.round(tgUser.total_minutes / 60)}시간 ({(tgUser.total_minutes).toFixed(1)}분)</span>
                                    <span className="text-slate-400 block text-[9px] mt-0.5">총 {tgUser.session_count}세션 격파</span>
                                  </div>
                                  <div className="bg-slate-900/40 p-2 rounded border border-slate-800/60 font-sans">
                                    <span className="text-slate-500 block text-[9px] uppercase font-bold">보유 골드 재화</span>
                                    <span className="text-amber-400 font-black font-mono">{(tgUser.coins).toLocaleString()} 골드</span>
                                    <span className="text-slate-400 block text-[9px] mt-0.5">칭호 {tgUser.titles_list ? tgUser.titles_list.length : 0}개 보유</span>
                                  </div>
                                </div>

                                {/* Titles unlocked list */}
                                <div>
                                  <span className="text-slate-500 text-[10px] block font-bold mb-1">👑 획득한 명예 칭호 목록:</span>
                                  <div className="flex flex-wrap gap-1">
                                    {tgUser.titles_list && tgUser.titles_list.length > 0 ? (
                                      tgUser.titles_list.map((title: string, idx: number) => (
                                        <span key={idx} className="bg-indigo-950/40 border border-indigo-900 text-indigo-300 text-[9px] px-1.5 py-0.5 rounded font-bold">
                                          {title}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-slate-600 italic">획득한 칭호가 아직 없습니다</span>
                                    )}
                                  </div>
                                </div>

                                {/* Award management tools */}
                                <div className="space-y-3 pt-2 border-t border-slate-900">
                                  {/* Award Coins & Hours Row */}
                                  <div className="grid grid-cols-2 gap-2">
                                    {/* Award Coins */}
                                    <div>
                                      <span className="text-[10px] text-slate-500 block font-bold">금마법 골드 수여</span>
                                      <div className="flex items-center gap-1 mt-1">
                                        <input
                                          type="number"
                                          value={grantCoinsInput}
                                          onChange={(e) => setGrantCoinsInput(Number(e.target.value))}
                                          className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-amber-400 font-bold text-xs font-mono"
                                          placeholder="골드액"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleAdminGrantCoins(tgUser.id, grantCoinsInput)}
                                          className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-black px-2 py-1 rounded text-[10px] cursor-pointer"
                                        >
                                          부여
                                        </button>
                                      </div>
                                    </div>

                                    {/* Award Time */}
                                    <div>
                                      <span className="text-[10px] text-slate-500 block font-bold">공헌 수련시간 수여</span>
                                      <div className="flex items-center gap-1 mt-1">
                                        <input
                                          type="number"
                                          value={grantHoursInput}
                                          step="0.5"
                                          onChange={(e) => setGrantHoursInput(Number(e.target.value))}
                                          className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-emerald-400 font-bold text-xs font-mono"
                                          placeholder="시간"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleAdminGrantTime(tgUser.id, grantHoursInput)}
                                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-2 py-1 rounded text-[10px] cursor-pointer"
                                        >
                                          주입
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Custom Rush Blessings Section (Requested Feature) */}
                                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-850 space-y-2 mt-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10.5px] text-indigo-300 font-bold block flex items-center gap-1">
                                        ✨ 가호 버프 러쉬 부여
                                      </span>
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          value={rushDurationInput}
                                          onChange={(e) => setRushDurationInput(Math.max(1, Number(e.target.value)))}
                                          className="w-12 bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-center text-white font-bold text-[10px] font-mono"
                                          min="1"
                                        />
                                        <span className="text-[9px] text-slate-400">분간</span>
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleAdminGrantCoinRush(tgUser.id, rushDurationInput)}
                                        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 font-bold py-1 px-1.5 rounded text-[9px] cursor-pointer flex items-center justify-center gap-1 transition-colors"
                                      >
                                        🪙 코인러쉬(3배)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleAdminGrantTimeRush(tgUser.id, rushDurationInput)}
                                        className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/25 font-bold py-1 px-1.5 rounded text-[9px] cursor-pointer flex items-center justify-center gap-1 transition-colors"
                                      >
                                        ⚡ 시간러쉬(120배)
                                      </button>
                                    </div>
                                  </div>

                                  {/* Quick Preset Study Injection (Consolidated from Magic Board) */}
                                  <div className="space-y-1.5 mt-2">
                                    <span className="font-bold text-[9px] text-slate-400 block tracking-wide uppercase font-mono">⚔️ 가상 수련기록 속성 주입 Presets</span>
                                    <div className="grid grid-cols-3 gap-1">
                                      <button
                                        type="button"
                                        onClick={() => injectMockStudySession(tgUser.id, 10)}
                                        className="bg-slate-900 hover:bg-slate-800 text-indigo-300 font-bold py-1 px-1 rounded text-[9px] border border-slate-800 cursor-pointer"
                                      >
                                        +10분
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => injectMockStudySession(tgUser.id, 60)}
                                        className="bg-slate-900 hover:bg-slate-800 text-indigo-300 font-bold py-1 px-1 rounded text-[9px] border border-slate-800 cursor-pointer"
                                      >
                                        +1시간
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => injectMockStudySession(tgUser.id, 180)}
                                        className="bg-slate-900 hover:bg-slate-800 text-indigo-300 font-bold py-1 px-1 rounded text-[9px] border border-slate-800 cursor-pointer"
                                      >
                                        +3시간
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-11 pt-[2px]">
                                      <button
                                        type="button"
                                        onClick={() => injectMockStudySession(tgUser.id, 3000)}
                                        className="bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 font-bold py-1 px-1.5 rounded text-[9px] border border-rose-500/15 cursor-pointer whitespace-nowrap"
                                      >
                                        💀 +50시간 각성
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => injectMockStudySession(tgUser.id, 18000)}
                                        className="bg-violet-950/30 hover:bg-violet-900/40 text-violet-300 font-bold py-1 px-1.5 rounded text-[9px] border border-violet-500/15 cursor-pointer whitespace-nowrap"
                                      >
                                        🌌 +300시간 무한각성
                                      </button>
                                    </div>
                                  </div>

                                  {/* GM Special Super Cheats (Consolidated from Magic Board) */}
                                  <div className="space-y-1 mt-2.5 pt-2 border-t border-slate-900/60">
                                    <button
                                      type="button"
                                      onClick={() => handleCoinsCheat(tgUser.id)}
                                      className="w-full flex items-center justify-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold py-1 px-2 rounded text-[9px] cursor-pointer hover:bg-amber-500/20"
                                    >
                                      <span>🪙 금광 더미 채굴 (치트 골드 +1,000 획득)</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDeveloperSuperCheat(tgUser.id)}
                                      className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-rose-600 via-purple-600 to-indigo-600 text-white font-black py-1.5 px-2 rounded-lg cursor-pointer text-[9px] hover:scale-[1.01] transition-transform shadow-md border border-pink-400/10 active:scale-95 duration-200"
                                    >
                                      <span>🛠️ [GM 특혜 수여] 1백만 골드 & 타이틀/전 보스 정복</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Warning delete button inside the developer panel */}
                                <div className="pt-2 border-t border-slate-900/60">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (confirm(`⚠️ 정말로 이 사용자(${tgUser.nickname})의 데이터베이스 내 모든 기록(공부 기입장, 칭호, 랭킹 및 프로필)을 완파 파쇄 지우시겠습니까? 복구는 불가능합니다.`)) {
                                        try {
                                          await DBProvider.deleteUserRecord(tgUser.id);
                                          showToast(`💀 ${tgUser.nickname} 모험가를 성역에서 영구히 파쇄 처리 완료했습니다.`, 'success');
                                          setSelectedAdminId('');
                                          await loadAdminUserData();
                                          await checkUserSession();
                                        } catch (e) {
                                          showToast('사용자 영구 파쇄 처리 중 신비로운 전극 오류 발생.', 'error');
                                        }
                                      }
                                    }}
                                    className="w-full bg-rose-950/65 hover:bg-rose-900 border border-rose-800/40 text-rose-300 font-bold py-1.5 px-3 rounded-lg text-[9px] cursor-pointer transition-all active:scale-95"
                                  >
                                    💥 이 모험가 계정 성역에서 영구 삭제 (추방 및 파쇄)
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                  </motion.div>
                )}

                {/* 2. HISTORY PANEL */}
                {activeTab === 'history' && (
                  <motion.div
                    key="history"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.2 }}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3">
                      <div>
                        <h3 className="text-lg font-bold font-display text-white">📖 통합 모험 수행 및 재화 수확 일지 (Quest Logs)</h3>
                        <p className="text-xs text-slate-400 mt-1">집중 전투 수련 기록과 성소 보스 정벌 전리품 획득 일지가 하나로 일목요연하게 합쳐진 유서 깊은 실시간 모험담입니다.</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                          총 {studySessions.length + achievements.length}건의 사적 기입 완료
                        </span>
                      </div>
                    </div>

                    {(() => {
                      // Compile both study sessions and achievements into a unified history timeline
                      const unifiedLogs = [
                        ...studySessions.map(session => ({
                          id: `session_${session.id}`,
                          date: new Date(session.started_at),
                          type: '⚔️ 수련 집중 완료 (모험 수행)',
                          description: `${session.duration_minutes}분 동안 수련을 격렬히 수행하고 보상을 적출하였습니다.`,
                          coinsEarned: session.earned_coins,
                          durationText: `${session.duration_minutes}분 집중`,
                          statusType: '수련 격파',
                          badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        })),

                        ...achievements.map(ach => {
                          const def = ACHIEVEMENTS.find(a => a.key === ach.achievement_key);
                          return {
                            id: `ach_${ach.id}`,
                            date: new Date(ach.unlocked_at),
                            type: '👑 비전 마수 토벌 보상 (업적 달성)',
                            description: `'${def?.name || ach.achievement_key}' 업적 달성 및 성소 수문장 영구 퇴치 완료.`,
                            coinsEarned: def?.rewardCoins || 0,
                            durationText: def?.rewardTitle || '전설의 업적',
                            statusType: '왕관 영속수여',
                            badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          };
                        })
                      ];

                      // Sort descending chronologically
                      unifiedLogs.sort((a, b) => b.date.getTime() - a.date.getTime());

                      return unifiedLogs.length === 0 ? (
                        <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-2xl">
                          <div className="inline-flex bg-slate-950 p-4 rounded-full text-slate-600 mb-3">
                            <History className="w-8 h-8" />
                          </div>
                          <h4 className="text-slate-300 font-bold">통합 모험 서적에 기록된 역사가 없습니다</h4>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-2 leading-relaxed">
                            집중 수련 타이머를 활성화하여 공부에 전념하거나, 보스 격파 과업을 완료하여 전설 일지를 채워 보십시오!
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                                <th className="py-3 px-4 font-bold">날짜 / 모험 시간</th>
                                <th className="py-3 px-4 font-bold">사건 및 모험 구획</th>
                                <th className="py-3 px-4 font-bold col-span-2">상세 내역 요강 및 가호 성과</th>
                                <th className="py-3 px-4 text-right font-bold">하사된 전리품 (골드)</th>
                                <th className="py-3 px-4 text-center font-bold">역사적 상태</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850">
                              {unifiedLogs.map((log) => {
                                const logDate = log.date;
                                const dateStr = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2,'0')}-${String(logDate.getDate()).padStart(2,'0')}`;
                                const timeStr = `${String(logDate.getHours()).padStart(2,'0')}:${String(logDate.getMinutes()).padStart(2,'0')}:${String(logDate.getSeconds()).padStart(2,'0')}`;

                                return (
                                  <tr key={log.id} className="hover:bg-slate-850/40 transition-colors">
                                    <td className="py-3.5 px-4 font-medium">
                                      <span className="block text-slate-100 font-bold">{dateStr}</span>
                                      <span className="text-[10px] text-slate-500 font-mono">{timeStr}</span>
                                    </td>
                                    <td className="py-3.5 px-4">
                                      <span className="font-bold text-slate-200 block text-[11px]">{log.type}</span>
                                      <span className="text-[10px] text-slate-405 font-mono">{log.durationText}</span>
                                    </td>
                                    <td className="py-3.5 px-4 text-slate-400 text-xs" colSpan={1}>
                                      {log.description}
                                    </td>
                                    <td className="py-3.5 px-4 text-right font-bold text-amber-400 font-mono text-[13px] whitespace-nowrap">
                                      {log.coinsEarned > 0 ? `+${log.coinsEarned.toLocaleString()} 🪙` : '0 🪙'}
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                      <span className={`inline-flex items-center gap-1 text-[10.5px] px-2.5 py-0.5 rounded-full border font-bold ${log.badgeColor}`}>
                                        {log.statusType}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </motion.div>
                )}

                {/* 3. ACHIEVEMENTS & BOSS RAID PANEL */}
                {activeTab === 'achievements' && (
                  <motion.div
                    key="achievements"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-6"
                  >
                    
                    {/* Top status progress card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                      <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                        <div>
                          <h3 className="text-lg font-bold font-display text-white">👾 전설의 수문장 보스 토벌 레이드</h3>
                          <p className="text-xs text-slate-400 mt-1">수련 집중 시간이 누적될 때마다 전방의 강력한 보스들이 격토되고 전설적인 칭호와 수만 냥의 전리품 골드를 수확합니다.</p>
                        </div>
                        <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl px-4 py-2 text-right">
                          <span className="text-[10px] font-mono text-slate-400 block font-bold">보스 정복 처단선율</span>
                          <span className="text-base font-black text-indigo-400 font-display">
                            {achievements.length} / {ACHIEVEMENTS.length}마리 완료 ({Math.floor((achievements.length / ACHIEVEMENTS.length) * 100)}%)
                          </span>
                        </div>
                      </div>

                      {/* Cumulative total gauge indicator */}
                      <div className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                        <div className="flex justify-between items-center text-xs mb-2">
                          <span className="text-slate-400 font-medium font-display">나의 전설적인 누적 전투 공적치 게이지:</span>
                          <span className="text-amber-400 font-mono font-bold text-sm">
                            {formatMinutesReadable(stats.totalMin)} ({(stats.totalMin / 60).toFixed(1)}시간)
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-400 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (stats.totalMin / (500 * 60)) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1.5">
                          <span>0시간</span>
                          <span>누적 500시간 돌파 시 최종 신 제우스 격퇴 성공!</span>
                        </div>
                      </div>
                    </div>

                    {/* Boss selection lists */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {ACHIEVEMENTS.map((ach) => {
                        const isUnlocked = achievements.some(a => a.achievement_key === ach.key);
                        const cumulativeHours = stats.totalMin / 60;
                        const progressPercent = ach.requiredHours === 0 
                          ? (studySessions.length >= 1 ? 100 : 0)
                          : Math.min(100, Math.floor((cumulativeHours / ach.requiredHours) * 100));

                        // Unique boss emojis - designed to look incredibly cool and distinct for all 16 progression zones
                        const getBossEmoji = (key: string) => {
                          switch (key) {
                            case 'first_study': return '🪵🤺'; // 1단계: 목각 연마인형
                            case 'focus_beginner': return '🌬️🌫️'; // 2단계: 방해의 안개 정령
                            case 'study_warrior': return '🦇🔥'; // 3단계: 잡념의 불나방 괴수
                            case 'mind_master': return '🪨🧌'; // 4단계: 수련 동굴의 바위 파수꾼
                            case 'midterm_boss': return '👿🌌'; // 5단계: 어둠의 나태 수호자
                            case 'final_boss': return '❄️👻'; // 6단계: 학업 슬럼프의 서리 악령
                            case 'csat_boss': return '🤺💀'; // 7단계: 한계 파멸의 고교 흑기사
                            case 'legendary_student': return '🧙‍♂️🔮'; // 8단계: 고대 도서관의 환영 도플갱어
                            case 'focus_specialist': return '⚡🪄'; // 9단계: 수문장 대마법사 지그문트
                            case 'master_of_will': return '⚙️🌀'; // 10단계: 차원 왜곡의 태엽 수리 기어
                            case 'time_destroyer': return '🐉⌛'; // 11단계: 시간의 절대 종단 크로노스
                            case 'scholar_of_truth': return '👼🌈'; // 12단계: 진리 수련의 오색 빛 대천사
                            case 'gatekeeper_of_abyss': return '👿🔥'; // 13단계: 심연의 어두운 학업마신 루시퍼
                            case 'legendary_grandmaster': return '🏛️🌳'; // 14단계: 신지식의 숲의 군주 프로메테우스
                            case 'academic_overseer': return '🦁💠'; // 15단계: 해달의 수수께끼 수호스핑크스
                            case 'ultimate_deity': return '👑✨'; // 16단계: 은하 주신 아스트라에아
                            default: return '👾🛸';
                          }
                        };

                        return (
                          <div
                            key={ach.key}
                            className={`p-5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                              isUnlocked
                                ? 'bg-slate-900/40 border-slate-800'
                                : 'bg-slate-900 border-indigo-500/10 shadow-lg'
                            }`}
                          >
                            {/* Defeated state filters */}
                            {isUnlocked && (
                              <div className="absolute top-0 right-0 bg-emerald-500/10 border-l border-b border-emerald-500/30 text-emerald-400 text-[10px] font-black px-3.5 py-1 rounded-bl-xl font-display uppercase tracking-widest z-10">
                                토벌 성공 🏆
                              </div>
                            )}

                            <div>
                              
                              {/* Boss identifier info */}
                              <div className="flex gap-3.5 items-start mb-4">
                                <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center text-2xl border select-none ${
                                  isUnlocked 
                                    ? 'bg-slate-950/60 border-slate-800 saturate-50' 
                                    : 'bg-slate-950 border-indigo-400/20'
                                }`}>
                                  {getBossEmoji(ach.key)}
                                </div>
                                <div className="flex-1">
                                  <span className="text-[9px] text-indigo-400 font-mono tracking-widest uppercase font-bold block">
                                    포격 거점 : {ach.key === 'first_study' ? '입문 초련의 방' : ach.requiredHours + '시간대의 관문'}
                                  </span>
                                  <h4 className={`text-base font-extrabold font-display ${isUnlocked ? 'text-slate-400 line-through' : 'text-slate-100'}`}>
                                    {ach.bossName}
                                  </h4>
                                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                    토벌 칭송 명의: {ach.name}
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/40 p-2.5 rounded-lg border border-slate-850">
                                  📖 {ach.description}
                                </p>

                                {/* Boss HP indicator */}
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] font-mono">
                                    <span className="text-rose-400 font-bold">HP 상태 {isUnlocked ? 0 : ach.bossHp} / {ach.bossHp}</span>
                                    <span className="text-slate-400">토벌 공략률 {progressPercent}%</span>
                                  </div>
                                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-1.5 rounded-full transition-all duration-300 ${
                                        isUnlocked ? 'bg-slate-700' : 'bg-rose-600'
                                      }`}
                                      style={{ width: `${isUnlocked ? 0 : (100 - progressPercent)}%` }}
                                    />
                                  </div>
                                </div>

                              </div>
                            </div>

                            {/* Rewards bottom layout */}
                             <div className="mt-5 pt-3.5 border-t border-slate-850 flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">토벌 훈장 & 포상 전리품</span>
                                <span className="text-xs font-bold text-amber-400 flex items-center gap-0.5 mt-0.5">
                                  +{ach.rewardCoins} 🪙
                                  {ach.rewardTitle && (
                                    <span className="text-indigo-300 ml-1.5 text-[10px] font-semibold bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                      👑 {ach.rewardTitle}
                                    </span>
                                  )}
                                </span>
                              </div>

                              {!isUnlocked ? (
                                <span className="text-[10px] text-indigo-400 font-mono flex items-center gap-1 font-bold bg-indigo-500/5 border border-indigo-500/10 px-2 py-1 rounded">
                                  <Lock className="w-3.5 h-3.5" />
                                  ⚔️ 레이드 공략 중
                                </span>
                              ) : (
                                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  🏆 토벌 격파 완료
                                </span>
                              )}
                            </div>

                          </div>
                        );
                      })}
                    </div>

                  </motion.div>
                )}

                {/* 4. RANKINGS BOARD PANEL */}
                {activeTab === 'rankings' && (
                  <motion.div
                    key="rankings"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.2 }}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl"
                  >
                    
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                      <div>
                        <h3 className="text-lg font-bold font-display text-white">🏆 명예의 전당 (서열 경쟁 보드)</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          대륙 전역의 모험가들과 수련 집중 시간 및 누적 황금 주머니 획득 경쟁을 치열하게 겨뤄보십시오!
                        </p>
                      </div>

                      {/* Filter Toggles */}
                      <div className="flex bg-slate-950 p-1 rounded-xl self-stretch sm:self-auto border border-slate-800 text-[11px]">
                        <button
                          onClick={() => setRankingType('today')}
                          className={`py-1.5 px-3 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                            rankingType === 'today' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          일일 격투
                        </button>
                        <button
                          onClick={() => setRankingType('week')}
                          className={`py-1.5 px-3 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                            rankingType === 'week' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          주간 원정
                        </button>
                        <button
                          onClick={() => setRankingType('total')}
                          className={`py-1.5 px-3 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                            rankingType === 'total' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          전설의 공적
                        </button>
                        <button
                          onClick={() => setRankingType('coins')}
                          className={`py-1.5 px-3 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                            rankingType === 'coins' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          부의 축적 (골드)
                        </button>
                      </div>
                    </div>

                    {/* Rankings Content List */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase tracking-wider">
                            <th className="py-3 px-4 font-bold">서열</th>
                            <th className="py-3 px-4 font-bold">모험가 명칭</th>
                            <th className="py-3 px-4 font-bold">수식 왕관 칭호</th>
                            <th className="py-3 px-4 font-bold text-right">
                              {rankingType === 'coins' ? '보유 골드' : '수련 집중 시간'}
                            </th>
                            {currentUser?.email === 'seungki611@gmail.com' && (
                              <th className="py-3 px-4 font-bold text-center">전적 관리</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {rankings.map((rk, idx) => {
                            const isUserRow = rk.is_user;
                            const isDevRow = isUserRow && currentUser?.email === 'seungki611@gmail.com';

                            // Custom medal tag
                            const getRankBadge = (rank: number) => {
                              if (rank === 1) return <span className="text-base select-none">🥇</span>;
                              if (rank === 2) return <span className="text-base select-none">🥈</span>;
                              if (rank === 3) return <span className="text-base select-none">🥉</span>;
                              return <span className="font-mono text-slate-500 font-bold ml-1">{rank}</span>;
                            };

                            return (
                              <tr
                                key={rk.nickname + '_' + idx}
                                className={`transition-all ${
                                  isDevRow
                                    ? 'bg-gradient-to-r from-red-500/10 via-purple-600/15 to-indigo-600/15 border-y-2 border-purple-500/30 glow-gold'
                                    : isUserRow
                                      ? 'bg-indigo-500/15 border-y-2 border-indigo-500/30'
                                      : 'hover:bg-slate-850/30'
                                }`}
                              >
                                <td className="py-3.5 px-4">
                                  {getRankBadge(rk.rank)}
                                </td>
                                <td className="py-3.5 px-4 font-medium flex items-center gap-1.5">
                                  <span className={`font-bold ${isDevRow ? 'text-amber-300' : isUserRow ? 'text-indigo-300' : 'text-slate-200'}`}>
                                    {rk.nickname}
                                  </span>
                                  {isUserRow && (
                                    <span className={`text-[9px] text-white font-bold px-1.5 py-0.5 rounded-full select-none ${
                                      isDevRow ? 'bg-gradient-to-r from-rose-500 to-indigo-500 glow-gold animate-pulse' : 'bg-indigo-500'
                                    }`}>
                                      {isDevRow ? '나 (GM 🛠️)' : '나'}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className={`text-[10px] px-2.5 py-1 rounded border ${
                                    isDevRow
                                      ? 'bg-purple-950/60 text-amber-300 border-purple-500/40 glow-gold font-bold'
                                      : 'bg-slate-950/60 text-slate-300 border-slate-800'
                                  }`}>
                                    {isDevRow ? '👑 총괄 게임마스터 GM (개발자)' : (rk.selected_title || '초련의 학습자')}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100 text-[13px]">
                                  {rankingType === 'coins' ? (
                                    <span className="text-amber-400">{rk.value.toLocaleString()} 🪙</span>
                                  ) : (
                                    formatMinutesReadable(rk.value)
                                  )}
                                </td>
                                {currentUser?.email === 'seungki611@gmail.com' && (
                                  <td className="py-3.5 px-4 text-center">
                                    {rk.is_user ? (
                                      <span className="text-slate-500 text-[10px] select-none font-medium">본인 계정</span>
                                    ) : (
                                      <div className="flex items-center justify-center">
                                        <div className="flex flex-col items-center gap-1 p-1 bg-slate-950/60 rounded-xl border border-slate-800">
                                          {/* Categories reset tools */}
                                          <div className="flex items-center gap-1">
                                            <button
                                              onClick={() => handleAdminResetCategory(rk.userId!, rk.nickname, 'today')}
                                              title="⚔️ 일일 격투(오늘 수련시간) 초기화"
                                              className="px-1.5 py-0.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-500/30 text-indigo-300 font-bold text-[9px] rounded transition-colors whitespace-nowrap cursor-pointer"
                                            >
                                              일일
                                            </button>
                                            <button
                                              onClick={() => handleAdminResetCategory(rk.userId!, rk.nickname, 'week')}
                                              title="🗺️ 주간 원정(이번주 수련시간) 초기화"
                                              className="px-1.5 py-0.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 font-bold text-[9px] rounded transition-colors whitespace-nowrap cursor-pointer"
                                            >
                                              주간
                                            </button>
                                            <button
                                              onClick={() => handleAdminResetCategory(rk.userId!, rk.nickname, 'total')}
                                              title="📜 저널의 공적(누적 수련시간) 초기화"
                                              className="px-1.5 py-0.5 bg-amber-950 hover:bg-amber-900 border border-amber-500/30 text-amber-300 font-bold text-[9px] rounded transition-colors whitespace-nowrap cursor-pointer"
                                            >
                                              전체
                                            </button>
                                            <button
                                              onClick={() => handleAdminResetCategory(rk.userId!, rk.nickname, 'coins')}
                                              title="💰 부의 축적(골드) 초기화"
                                              className="px-1.5 py-0.5 bg-rose-950 hover:bg-rose-900 border border-rose-500/30 text-rose-300 font-bold text-[9px] rounded transition-colors whitespace-nowrap cursor-pointer"
                                            >
                                              골드
                                            </button>
                                          </div>

                                          <div className="w-full h-px bg-slate-800/40 my-0.5" />

                                          {deletingUserId === rk.userId ? (
                                            <div className="flex items-center gap-1">
                                              <button
                                                onClick={() => {
                                                  if (rk.userId) {
                                                    handleDeleteRankingUser(rk.userId, rk.nickname);
                                                  }
                                                }}
                                                className="bg-red-600 hover:bg-red-500 text-white font-extrabold px-1.5 py-0.5 rounded text-[8px] cursor-pointer whitespace-nowrap animate-pulse"
                                              >
                                                확인
                                              </button>
                                              <button
                                                onClick={() => setDeletingUserId(null)}
                                                className="bg-slate-805 hover:bg-slate-705/85 text-slate-300 px-1.5 py-0.5 rounded text-[8px] cursor-pointer whitespace-nowrap"
                                              >
                                                취소
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              onClick={() => setDeletingUserId(rk.userId || null)}
                                              title="💀 계정 및 모든 전적 영구 파쇄 삭제"
                                              className="text-red-400 hover:text-red-300 font-bold text-[9px] cursor-pointer hover:underline mb-0.5"
                                            >
                                              💥 계정 자체 축출
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-4 leading-relaxed font-mono">
                      * 명예의 전당 서열판은 전 서버에서 수련 중인 실제 모험가들의 실시간 데이터를 기반으로 순위가 집계됩니다.
                    </p>

                  </motion.div>
                )}

                {/* 5. PROFILE & TITLE EQUIPMENT PANEL */}
                {activeTab === 'profile' && (
                  <motion.div
                    key="profile"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-6"
                  >
                    
                    {/* Left Column (Nickname modification form) */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                      <div>
                        <h3 className="text-lg font-bold font-display text-white mb-1">📜 모험가 신원 정보서</h3>
                        <p className="text-xs text-slate-400 mb-5">대륙에서 활약 중인 본인의 대외 명의(닉네임)와 장착한 왕관 칭호를 관리하십시오.</p>

                        <form onSubmit={handleUpdateNicknameSubmit} className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase font-mono tracking-wider">📧 영혼 연동 마법 이메일</label>
                            <input
                              type="email"
                              disabled
                              value={currentUser.email || ''}
                              className="w-full bg-slate-950/80 border border-slate-850 rounded-xl px-3.5 py-2.5 text-sm text-slate-500"
                            />
                            <span className="text-[10px] text-slate-500 mt-1 block">이메일 연동 주소는 영혼에 봉인되어 변경할 수 없습니다.</span>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase font-mono tracking-wider">🏷️ 대외적 모험가명 변경</label>
                            <input
                              type="text"
                              required
                              value={newNickname}
                              onChange={(e) => setNewNickname(e.target.value)}
                              placeholder="새로운 모험가명 입력"
                              maxLength={15}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={profileSaving}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-3 rounded-xl cursor-pointer transition-colors shadow-md active:scale-98"
                          >
                            {profileSaving ? '대마법 등록소 작성 중...' : '💾 신원 등록증 수저 저장'}
                          </button>
                        </form>
                      </div>

                      {/* Account system notes */}
                      <div className="mt-8 pt-4 border-t border-slate-850 text-xs text-slate-400 leading-relaxed font-mono space-y-2">
                        <div className="flex justify-between items-center mb-1">
                          <span>인증 마법 유형:</span>
                          <span className={`font-bold ${isSupabaseMode ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {isSupabaseMode ? '🌐 Supabase 구름 연동' : '💾 로컬 컴퓨터 저장'}
                          </span>
                        </div>

                        {/* Toggle switch inside profile */}
                        <div className="pt-2">
                          {isSupabaseMode ? (
                            <button
                              type="button"
                              onClick={() => {
                                try {
                                  localStorage.setItem('quest_force_local_mode', 'true');
                                  setIsSupabaseMode(false);
                                  showToast('💾 즉시 로컬 저장 단독 모드로 전환되었습니다! 이후 가입 및 저장은 모두 기기에 기록됩니다.', 'info');
                                  checkUserSession();
                                } catch (e) {
                                  console.error(e);
                                }
                              }}
                              className="w-full bg-slate-950 hover:bg-slate-850 border border-amber-500/30 text-amber-500 font-semibold text-[10px] py-1.5 px-2.5 rounded-lg cursor-pointer transition-all active:scale-95 text-center"
                            >
                              ⚙️ 로컬 브라우저 저장 모드로 강제 전환
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                try {
                                  localStorage.removeItem('quest_force_local_mode');
                                  const configActive = DBProvider.isSupabase();
                                  setIsSupabaseMode(configActive);
                                  if (configActive) {
                                    showToast('🌐 구름 서버 연동(Supabase) 모드가 성공적으로 활성화되었습니다!', 'success');
                                    checkUserSession();
                                  } else {
                                    showToast('⚙️ Supabase 환경 변수가 설정되어 있지 않아 서버 모드로 전환할 수 없습니다.', 'error');
                                  }
                                } catch (e) {
                                  console.error(e);
                                }
                              }}
                              className="w-full bg-slate-950 hover:bg-slate-850 border border-emerald-500/30 text-emerald-500 font-semibold text-[10px] py-1.5 px-2.5 rounded-lg cursor-pointer transition-all active:scale-95 text-center"
                            >
                              ⚙️ Supabase 구름 서버 연동 모드로 복귀 시도
                            </button>
                          )}
                        </div>

                        <div className="flex justify-between">
                          <span>획득 전리품 왕관:</span>
                          <span className="font-bold text-indigo-400">{titles.length}개 전수 완료</span>
                        </div>
                      </div>

                    </div>

                    {/* Right column (Titles Management Equipment Grid) */}
                    <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                      <div className="mb-5">
                        <h3 className="text-lg font-bold font-display text-white">👑 장착 가능한 명예 왕관 칭호 도감</h3>
                        <p className="text-xs text-slate-400 mt-1">공적 달성 및 강력한 보스를 영광스럽게 퇴치하며 획득한 비전 칭호입니다. 하나를 장착하여 명예의 전당과 대시보드에 휘감아 내십시오!</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Developer Exclusive Master Creator Title */}
                        {currentUser?.email === 'seungki611@gmail.com' && (
                          <div
                            onClick={() => handleEquipTitle('👑 총괄 게임마스터 GM (개발자)')}
                            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between col-span-1 sm:col-span-2 bg-gradient-to-r from-red-500/10 via-purple-600/10 to-indigo-600/10 ${
                              currentProfile.selected_title === '👑 총괄 게임마스터 GM (개발자)'
                                ? 'border-amber-500 glow-gold'
                                : 'border-purple-800/60 hover:border-purple-600'
                            }`}
                          >
                            <div>
                              <div className="flex justify-between items-start">
                                <span className="text-xs font-black text-amber-300 font-display flex items-center gap-1.5">
                                  👑 총괄 게임마스터 GM (개발자) 👑
                                </span>
                                {currentProfile.selected_title === '👑 총괄 게임마스터 GM (개발자)' && (
                                  <span className="bg-gradient-to-r from-amber-500 to-red-600 text-white font-bold text-[8px] px-1.5 py-0.5 rounded-full uppercase glow-gold animate-pulse">장착 중</span>
                                )}
                              </div>
                              <p className="text-[11px] text-purple-300 mt-1.5">이 세계선을 창조하고 설계한 seungki611@gmail.com 개발자 전용 전설의 영속 배지</p>
                            </div>
                            <span className="text-[10px] text-amber-400 font-semibold mt-3">🛠️ 개발자 권리 영속 귀속</span>
                          </div>
                        )}

                        {/* Always have default title '첫걸음 학습자' */}
                        <div
                          onClick={() => handleEquipTitle('첫걸음 학습자')}
                          className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                            currentProfile.selected_title === '첫걸음 학습자'
                              ? 'bg-indigo-600/10 border-indigo-500 glow-blue'
                              : 'bg-slate-950/80 border-slate-850 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-black text-indigo-300 font-display">초련의 학습자 🔰</span>
                              {currentProfile.selected_title === '첫걸음 학습자' && (
                                <span className="bg-indigo-500 text-white font-bold text-[8px] px-1.5 py-0.5 rounded-full uppercase">장착 중</span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1.5">여정의 서막을 개시할 때 최초 무상 영속 수여받는 신참 모험가 칭호</p>
                          </div>
                          <span className="text-[10px] text-indigo-400/80 font-semibold mt-3">기본 영속 수여</span>
                        </div>

                        {/* List other potentially owned titles */}
                        {ACHIEVEMENTS.map((ach) => {
                          if (!ach.rewardTitle) return null;
                          const hasUnlockedTitle = titles.some(t => t.title === ach.rewardTitle);

                          return (
                            <div
                              key={ach.key}
                              onClick={() => {
                                if (hasUnlockedTitle) {
                                  handleEquipTitle(ach.rewardTitle!);
                                } else {
                                  showToast(`'${ach.bossName}' 보스 토벌 처치 업적 달성 시 잠금이 해제되는 한정 칭호입니다!`, 'info');
                                }
                              }}
                              className={`p-4 rounded-xl border transition-all ${
                                hasUnlockedTitle ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                              } ${
                                hasUnlockedTitle
                                  ? currentProfile.selected_title === ach.rewardTitle
                                    ? 'bg-indigo-600/10 border-indigo-500 glow-blue'
                                    : 'bg-slate-950/80 border-slate-850 hover:border-slate-700'
                                  : 'bg-slate-950/20 border-dashed border-slate-850'
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <span className={`text-xs font-black font-display ${hasUnlockedTitle ? 'text-indigo-300' : 'text-slate-500'}`}>
                                  {ach.rewardTitle}
                                </span>
                                {currentProfile.selected_title === ach.rewardTitle && (
                                  <span className="bg-indigo-500 text-white font-bold text-[8px] px-1.5 py-0.5 rounded-full uppercase">장착 중</span>
                                )}
                              </div>

                              <p className="text-[11px] text-slate-400 mt-1.5">
                                {hasUnlockedTitle 
                                  ? `${ach.bossName} 처치 기념 전리품` 
                                  : `${ach.requiredHours}시간 대화적 축적 필요`
                                }
                              </p>

                              <div className="flex justify-between items-center mt-3">
                                <span className="text-[9px] font-mono text-slate-500">잠금 조건: {ach.requiredHours === 0 ? '첫 세션' : `${ach.requiredHours}시간 달성`}</span>
                                {!hasUnlockedTitle ? (
                                  <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                                    <Lock className="w-3 h-3" /> 잠김
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 font-bold">
                                    <Unlock className="w-3 h-3" /> 획득됨
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>

                    {/* NEW COMPONENT: CUSTOM COMPANION AVATAR SELECTOR EXPOSITION */}
                    <div className="md:col-span-3 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl mt-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 text-indigo-500/5 pointer-events-none">
                        <Sparkles className="w-48 h-48" />
                      </div>

                      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <span className="bg-indigo-600/15 text-indigo-450 font-extrabold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider border border-indigo-500/20 font-mono">
                            🐾 소울 가디언 파트너 시스템
                          </span>
                          <h3 className="text-xl sm:text-2xl font-black font-display text-white mt-1.5 flex items-center gap-2">
                            ✨ 내 곁을 지키는 아바타 동반 소집소
                          </h3>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            나만의 개성이 뚜렷한 수호신 파트너를 소집해 보십시오. 보스 토벌 퀘스트 수험 진도에 맞춰 아바타가 <strong>총 6단계에 걸쳐 찬란히 진화</strong>합니다.
                            <br />
                            아바타를 도중에 변경하더라도 달성해 놓은 공적(클리어 퀘스트 수)에 따른 진화 혜택은 실시간으로 고스란히 동기화됩니다!
                          </p>
                        </div>

                        <div className="bg-slate-950 px-4 py-3 rounded-2xl border border-slate-800 text-right shrink-0">
                          <p className="text-[10px] text-slate-500 font-bold uppercase font-mono">나의 보스 퀘스트 공적치</p>
                          <p className="text-lg font-black text-indigo-400 font-mono">{achievements.length}개 보스 격파</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">현재 수호 정령 진화 수준: <span className="text-emerald-400 font-bold font-mono">Stage {getEvolutionStageIndex(achievements.length)}</span></p>
                        </div>
                      </div>

                      {/* Main Avatar Selection Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {AVATARS.map((av) => {
                          const isSelected = selectedAvatarKey === av.key;
                          const currentStageIdx = getEvolutionStageIndex(achievements.length);
                          const activeStageOfThisAv = av.stages[currentStageIdx] || av.stages[0];

                          return (
                            <div
                              key={av.key}
                              className={`rounded-2xl border p-5 flex flex-col justify-between transition-all select-none relative ${
                                isSelected
                                  ? 'bg-slate-950 border-indigo-500 ring-2 ring-indigo-500/15 drop-shadow-xl'
                                  : 'bg-slate-950/40 border-slate-850 hover:bg-slate-950/80 hover:border-slate-700'
                              }`}
                            >
                              <div>
                                {/* Active Badge & Selection tag */}
                                <div className="flex items-center justify-between mb-4">
                                  <span className="text-[10px] bg-slate-905 text-slate-350 font-bold px-2 py-0.5 rounded border border-slate-800 font-mono">
                                    {av.badge}
                                  </span>
                                  {isSelected ? (
                                    <span className="bg-gradient-to-r from-indigo-505 to-indigo-600 text-white font-bold text-[9px] px-2 py-0.5 rounded-full animate-pulse flex items-center gap-0.5 shadow-md">
                                      <Check className="w-3 h-3 text-white fill-current shrink-0" /> 동행 중
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleSelectAvatar(av.key)}
                                      className="text-indigo-400 bg-indigo-550/10 hover:bg-indigo-500/20 text-[10px] font-bold px-2.5 py-1 rounded-full cursor-pointer transition-colors"
                                    >
                                      동행 계약
                                    </button>
                                  )}
                                </div>

                                {/* Avatar Large State Face */}
                                <div className="flex flex-col items-center justify-center my-4 py-2 bg-gradient-to-b from-slate-900/50 to-slate-950/70 rounded-xl border border-slate-900/40 relative group">
                                  {/* Evolution Stage Indicator Glow */}
                                  <div className="text-6xl select-none animate-bounce" style={{ animationDuration: '4.5s' }}>
                                    {activeStageOfThisAv.emoji}
                                  </div>
                                  <p className="text-xs font-black text-slate-100 mt-3 flex items-center gap-1">
                                    {activeStageOfThisAv.name}
                                  </p>
                                  <span className="text-[9px] text-slate-505 font-mono mt-0.5 font-bold uppercase tracking-widest text-center">
                                    Stage {currentStageIdx}
                                  </span>
                                </div>

                                {/* Meta text */}
                                <h4 className="text-sm font-extrabold text-white font-display mt-2">{av.name}</h4>
                                <p className="text-[11px] text-indigo-300 font-medium italic mt-1 pb-2 border-b border-slate-900 leading-relaxed">
                                  "{av.personality}"
                                </p>
                                <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed font-sans">
                                  <strong className="text-slate-200">현재 수호 태세:</strong> {activeStageOfThisAv.description}
                                </p>
                              </div>

                              {/* Tiny Encyclopedia Preview */}
                              <div className="mt-4 pt-3.5 border-t border-slate-900">
                                <span className="text-[9px] font-mono text-slate-500 block uppercase tracking-wide">🔍 6단계 진화 대전집</span>
                                <div className="grid grid-cols-6 gap-0.5 mt-1.5 bg-slate-900/50 p-1 rounded-lg border border-slate-900">
                                  {av.stages.map((stg) => {
                                    const isUnlocked = stg.stage <= currentStageIdx;
                                    return (
                                      <div
                                        key={stg.stage}
                                        title={`[Stage ${stg.stage}] ${stg.name} - ${stg.description}`}
                                        onClick={() => {
                                          showToast(`🔬 [Stage ${stg.stage} - ${stg.name} 도감]: ${stg.description}`, 'info');
                                        }}
                                        className={`h-8 rounded-md flex items-center justify-center text-sm cursor-help relative transition-all ${
                                          isUnlocked 
                                            ? 'bg-slate-950 border border-indigo-500/30 font-bold hover:scale-105 hover:bg-indigo-900/20' 
                                            : 'bg-slate-950/25 border border-slate-900 filter saturate-0 opacity-40 hover:opacity-100'
                                        }`}
                                      >
                                        <span>{stg.emoji}</span>
                                        {stg.stage === currentStageIdx && (
                                          <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </motion.div>
                )}

                {/* 6. SHOPS BOARD PANEL */}
                {activeTab === 'shop' && (
                  <motion.div
                    key="shop"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    {/* Header Banner */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
                      
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                        <div>
                          <span className="bg-amber-500/15 text-amber-400 font-extrabold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider border border-amber-500/20 font-mono">
                            🏪 엘프라 성역 길드 보물창고
                          </span>
                          <h3 className="text-2xl font-black font-display text-white mt-1.5 flex items-center gap-2">
                            🏪 황금 만능 물품 상점 (Guild Merchant Shop)
                          </h3>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            공부 수련을 극대화시켜주는 <strong>전설의 시간 가속서</strong>와 동행 아바타 정령을 아름답게 치장할 수 있는 <strong>특수 연성 장식</strong>을 골드로 청약해 보십시오!
                          </p>
                        </div>

                        {/* Gold Balance Box */}
                        {currentProfile && (
                          <div className="bg-slate-950 p-4 rounded-2xl border-2 border-amber-500/20 text-right shrink-0 min-w-[200px] shadow-lg">
                            <p className="text-[10px] text-slate-500 font-bold uppercase font-mono">보유 중인 모험가 금고 잔고</p>
                            <p className="text-2xl font-black text-amber-400 font-mono mt-0.5 flex items-center justify-end gap-1">
                              <span>{currentProfile.coins.toLocaleString()}</span> <span className="text-xs font-bold text-slate-400">골드 (🪙)</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Shop Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                      
                      {/* Left: Interactive Purchasable list */}
                      <div className="col-span-12 lg:col-span-8 space-y-6">
                        
                        {/* Section 1: Speed Manuals */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                          <h4 className="text-sm font-black text-slate-200 uppercase tracking-widest font-mono mb-4 flex items-center gap-2">
                            ⚡ 전설의 비약 가속서 고서 및 배수 비지서
                          </h4>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Speed 5x upgrade */}
                            {(() => {
                              const isBought = shopUpgrades.timeSpeedLimit >= 5;
                              const cost = 500;
                              return (
                                <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                                  isBought ? 'bg-slate-950/40 border-slate-850' : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                                }`}>
                                  <div>
                                    <div className="flex justify-between items-start">
                                      <span className="text-xs font-black text-indigo-300 font-display flex items-center gap-1">
                                        📜 모래시계 마법 비약서 - [5배속] 
                                      </span>
                                      {isBought && <span className="bg-emerald-500/10 text-emerald-400 font-bold text-[8px] px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">전수 완료</span>}
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">타이머 공부 속도를 실시간 최대 5배속까지 해방할 수 있게 해주는 가속 연성서입니다.</p>
                                  </div>
                                  <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center">
                                    <span className="text-xs font-bold text-amber-400 font-mono">{cost.toLocaleString()} 🪙</span>
                                    <button
                                      type="button"
                                      disabled={isBought}
                                      onClick={() => handleBuyItem('speed_5', cost)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                                        isBought 
                                          ? 'bg-slate-900 text-slate-600 cursor-not-allowed' 
                                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md active:scale-95'
                                      }`}
                                    >
                                      {isBought ? '잠금 장치 해제됨' : '비법 전수'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Speed 10x upgrade */}
                            {(() => {
                              const isBought = shopUpgrades.timeSpeedLimit >= 10;
                              const isEligible = shopUpgrades.timeSpeedLimit >= 5;
                              const cost = 1200;
                              return (
                                <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                                  isBought ? 'bg-slate-950/40 border-slate-850' : !isEligible ? 'opacity-50' : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                                }`}>
                                  <div>
                                    <div className="flex justify-between items-start">
                                      <span className="text-xs font-black text-indigo-300 font-display flex items-center gap-1">
                                        📜 수련 영웅 대가속 비급 - [10배속]
                                      </span>
                                      {isBought ? (
                                        <span className="bg-emerald-500/10 text-emerald-400 font-bold text-[8px] px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">전수 완료</span>
                                      ) : !isEligible && (
                                        <span className="text-slate-500 text-[8px] flex items-center gap-0.5">🔒 선행 비약 필요</span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">전투 속도를 최대 10배 축적시킬 수 있는 고계위 마법 비지서입니다. 선행 5배속 전수가 필요합니다.</p>
                                  </div>
                                  <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center">
                                    <span className="text-xs font-bold text-amber-400 font-mono">{cost.toLocaleString()} 🪙</span>
                                    <button
                                      type="button"
                                      disabled={isBought || !isEligible}
                                      onClick={() => handleBuyItem('speed_10', cost)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                                        isBought 
                                          ? 'bg-slate-900 text-slate-600 cursor-not-allowed' 
                                          : !isEligible
                                            ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md active:scale-95'
                                      }`}
                                    >
                                      {isBought ? '잠금 장치 해제됨' : '비법 전수'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Speed 120x upgrade */}
                            {(() => {
                              const isBought = shopUpgrades.timeSpeedLimit >= 120;
                              const isEligible = shopUpgrades.timeSpeedLimit >= 10;
                              const cost = 5050;
                              return (
                                <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                                  isBought ? 'bg-slate-950/40 border-slate-850' : !isEligible ? 'opacity-50' : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                                }`}>
                                  <div>
                                    <div className="flex justify-between items-start">
                                      <span className="text-xs font-black text-rose-300 font-display flex items-center gap-1">
                                        🌌 전설의 극초광속 마법서 - [120배속]
                                      </span>
                                      {isBought ? (
                                        <span className="bg-emerald-500/10 text-emerald-400 font-bold text-[8px] px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">전수 완료</span>
                                      ) : !isEligible && (
                                        <span className="text-slate-500 text-[8px] flex items-center gap-0.5">🔒 선행 비약 필요</span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">시간축의 왜곡을 일으켜 무려 1초당 2분(120배 가속)의 수련 시간을 누적시켜 가호 보상을 거둡니다.</p>
                                  </div>
                                  <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center">
                                    <span className="text-xs font-bold text-amber-400 font-mono">{cost.toLocaleString()} 🪙</span>
                                    <button
                                      type="button"
                                      disabled={isBought || !isEligible}
                                      onClick={() => handleBuyItem('speed_120', cost)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                                        isBought 
                                          ? 'bg-slate-900 text-slate-600 cursor-not-allowed' 
                                          : !isEligible
                                            ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                                            : 'bg-rose-600 hover:bg-rose-500 text-white shadow-md active:scale-95'
                                      }`}
                                    >
                                      {isBought ? '잠금 장치 해제됨' : '시간 해방'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Gold Multiplier 1.5x upgrade */}
                            {(() => {
                              const isBought = shopUpgrades.goldRateLimit >= 1.5;
                              const cost = 600;
                              return (
                                <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                                  isBought ? 'bg-slate-950/40 border-slate-850' : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                                }`}>
                                  <div>
                                    <div className="flex justify-between items-start">
                                      <span className="text-xs font-black text-amber-300 font-display flex items-center gap-1">
                                        🧪 황금 연성 전도율 - [수확 1.5배]
                                      </span>
                                      {isBought && <span className="bg-emerald-500/10 text-emerald-400 font-bold text-[8px] px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono font-mono font-bold">황금 연성됨</span>}
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">수련 완료 시 획득하는 모든 골드 수익률을 영구적으로 +50% (1.5배)로 재배 시키는 기초 마법식입니다.</p>
                                  </div>
                                  <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center">
                                    <span className="text-xs font-bold text-amber-400 font-mono">{cost.toLocaleString()} 🪙</span>
                                    <button
                                      type="button"
                                      disabled={isBought}
                                      onClick={() => handleBuyItem('gold_1_5', cost)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                                        isBought 
                                          ? 'bg-slate-900 text-slate-600 cursor-not-allowed' 
                                          : 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-black shadow-md active:scale-95'
                                      }`}
                                    >
                                      {isBought ? '연금술 활성화됨' : '제련 연성'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Gold Multiplier 2.5x upgrade */}
                            {(() => {
                              const isBought = shopUpgrades.goldRateLimit >= 2.5;
                              const isEligible = shopUpgrades.goldRateLimit >= 1.5;
                              const cost = 1500;
                              return (
                                <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                                  isBought ? 'bg-slate-950/40 border-slate-850' : !isEligible ? 'opacity-50' : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                                }`}>
                                  <div>
                                    <div className="flex justify-between items-start">
                                      <span className="text-xs font-black text-amber-300 font-display flex items-center gap-1">
                                        🧪 대현자의 골드 양 가속 - [수확 2.5배]
                                      </span>
                                      {isBought ? (
                                        <span className="bg-emerald-500/10 text-emerald-400 font-bold text-[8px] px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">황금 연성됨</span>
                                      ) : !isEligible && (
                                        <span className="text-slate-500 text-[8px] flex items-center gap-0.5">🔒 선행 도식 필요</span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">연성 효율의 임계치를 한층 더 끌어올려 무려 수련 보상을 2.5배(250%)로 영구 부스팅 시켜줍니다.</p>
                                  </div>
                                  <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center">
                                    <span className="text-xs font-bold text-amber-400 font-mono">{cost.toLocaleString()} 🪙</span>
                                    <button
                                      type="button"
                                      disabled={isBought || !isEligible}
                                      onClick={() => handleBuyItem('gold_2_5', cost)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                                        isBought 
                                          ? 'bg-slate-900 text-slate-600 cursor-not-allowed' 
                                          : !isEligible
                                            ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                                            : 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-black shadow-md active:scale-95'
                                      }`}
                                    >
                                      {isBought ? '연금술 활성화됨' : '제련 연성'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Gold Multiplier 5.0x upgrade */}
                            {(() => {
                              const isBought = shopUpgrades.goldRateLimit >= 5.0;
                              const isEligible = shopUpgrades.goldRateLimit >= 2.5;
                              const cost = 3500;
                              return (
                                <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                                  isBought ? 'bg-slate-950/40 border-slate-850' : !isEligible ? 'opacity-50' : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                                }`}>
                                  <div>
                                    <div className="flex justify-between items-start">
                                      <span className="text-xs font-black text-yellow-300 font-display flex items-center gap-1">
                                        🌟 마이더스 골드 연성 진수 - [수확 5.0배]
                                      </span>
                                      {isBought ? (
                                        <span className="bg-emerald-500/10 text-emerald-400 font-bold text-[8px] px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">만능 연성됨</span>
                                      ) : !isEligible && (
                                        <span className="text-slate-500 text-[8px] flex items-center gap-0.5">🔒 선행 연성 필요</span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">최고위 만능 제련 연성술. 수행하는 집중 공부 1분 한 회마다 5골드를 수확하는 경이로운 재화 마법입니다.</p>
                                  </div>
                                  <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center">
                                    <span className="text-xs font-bold text-amber-400 font-mono">{cost.toLocaleString()} 🪙</span>
                                    <button
                                      type="button"
                                      disabled={isBought || !isEligible}
                                      onClick={() => handleBuyItem('gold_5_0', cost)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                                        isBought 
                                          ? 'bg-slate-900 text-slate-600 cursor-not-allowed' 
                                          : !isEligible
                                            ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95 font-extrabold'
                                      }`}
                                    >
                                      {isBought ? '신령 연금 활성됨' : '연금 완성'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                      </div>

                      {/* Right: Unprepared/Teasing coming soon section */}
                      <div className="col-span-12 lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest font-mono flex items-center gap-1">
                            🛡️ 입망 준비 중인 신화적 무기 보급 수첩
                          </span>
                          <p className="text-xs text-slate-400 mt-2 mb-4 leading-relaxed">
                            공부 상단의 연금술 총괄 학회가 현재 고난도 고대 유적지 심연의 보수 퀘스트 업데이트와 합쳐 정비 중인 기성 고계 위 기사 단독 장비들입니다.
                          </p>

                          <div className="space-y-4">
                            {/* Teaser 1: Mana Elixir */}
                            <div className="bg-slate-950/40 p-3.5 rounded-xl border border-dashed border-slate-850">
                              <div className="flex items-center justify-between text-xs font-extrabold text-slate-500">
                                <span>🧪 신비의 특수 정령 마법 비급</span>
                                <span className="bg-slate-900 text-slate-500 text-[8px] px-1.5 py-0.5 rounded font-bold">대기 중</span>
                              </div>
                              <p className="text-[11px] text-slate-600 mt-1.5">새로운 정령형 신 수호수들을 다수 전장 동맹 수집할 수 있는 청정 앰플 정제수입니다.</p>
                              <span className="text-[9.5px] text-amber-650 font-bold block mt-2">상태: ⚖️ 조제 연마 대기 중</span>
                            </div>

                            {/* Teaser 2: Armor */}
                            <div className="bg-slate-950/40 p-3.5 rounded-xl border border-dashed border-slate-850">
                              <div className="flex items-center justify-between text-xs font-extrabold text-slate-500">
                                <span>🛡️ 성스러운 수호 기사의 성채 갑옷</span>
                                <span className="bg-slate-900 text-slate-500 text-[8px] px-1.5 py-0.5 rounded font-bold">대기 중</span>
                              </div>
                              <p className="text-[11px] text-slate-600 mt-1.5">아바타에 강인한 중갑 플레이트를 입혀 수렴 사냥터 피격 대미지를 추가 반사합니다.</p>
                              <span className="text-[9.5px] text-indigo-500 font-bold block mt-2">상태: 🔨 드워프 제철소 대장간 야장 중</span>
                            </div>

                            {/* Teaser 3: Pact */}
                            <div className="bg-slate-950/40 p-3.5 rounded-xl border border-dashed border-slate-850">
                              <div className="flex items-center justify-between text-xs font-extrabold text-slate-500">
                                <span>📜 고대 신룡 협약 계약서</span>
                                <span className="bg-slate-900 text-slate-500 text-[8px] px-1.5 py-0.5 rounded font-bold">대기 중</span>
                              </div>
                              <p className="text-[11px] text-slate-600 mt-1.5">전설 중의 전설, 드래곤과의 직접적인 피의 맹세를 체결하여 광휘 마법을 소환합니다.</p>
                              <span className="text-[11px] text-rose-500 font-bold block mt-2">상태: 📖 길드 조약 문서 고정 대기</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-850 text-center mt-5">
                          <p className="text-[10px] text-slate-505 leading-normal">
                            * 모험가 협조 제안 사항이나 건의할 상점 신설 품목은 언제든 '길드 모험 관리청(GM)'에 사양 전력 접수해 주십시오!
                          </p>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-slate-900 border-t border-slate-850 py-6 text-center text-xs text-slate-500 font-mono mt-12">
        <p>© 2026 Study Coin Quest. All Rights Reserved.</p>
        <p className="mt-1 text-[10px] text-slate-600">공부 시간은 코인이 되고, 코인은 열정의 불꽃이 됩니다.</p>
      </footer>

      {/* POPUP: REWARD breakout on study completion */}
      <AnimatePresence>
        {sessionFinishReward && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border-2 border-amber-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative"
            >
              <div className="text-center">
                <div className="inline-flex bg-amber-500/10 p-3 rounded-full text-amber-400 mb-3 animate-spin" style={{ animationDuration: '4s' }}>
                  <Coins className="w-8 h-8" />
                </div>
                
                <h3 className="text-lg font-bold font-display text-white">⚔️ 수련 집중 성공 및 전리품 보상 하사!</h3>
                <p className="text-xs text-slate-400 mt-1">불타는 학문의 고뇌와 집중에 마침내 성공하여 찬란한 황금 주머니를 하사받았습니다!</p>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 my-4 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">수련(집중) 지속 시간:</span>
                    <span className="text-white font-mono font-bold">{sessionFinishReward.minutes}분</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">기본 수력 골드 (1분=1골드):</span>
                    <span className="text-amber-400 font-mono font-bold">{sessionFinishReward.baseCoins} 🪙</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">연속 각성 기백 보너스:</span>
                    <span className="text-amber-400 font-mono font-bold">+{sessionFinishReward.bonusCoins} 🪙</span>
                  </div>
                  <div className="border-t border-slate-800 my-2 pt-2 flex justify-between text-sm font-bold">
                    <span className="text-slate-200">총 수득 골드:</span>
                    <span className="text-yellow-400">{sessionFinishReward.totalCoins} 🪙</span>
                  </div>
                </div>

                <button
                  onClick={() => setSessionFinishReward(null)}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs py-3 rounded-xl cursor-pointer transition-colors shadow-lg active:scale-98"
                >
                  기분 좋게 포상 수령하고 모험 속행 🛡️
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* POPUP: BOSS DEFEATED Celebration modal */}
      <AnimatePresence>
        {bossClearCelebration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-indigo-950 border-2 border-amber-400 rounded-3xl p-6 max-w-md w-full shadow-2xl relative text-center overflow-hidden"
            >
              {/* Top lighting animation */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-yellow-300 via-amber-500 to-yellow-300 animate-pulse" />

              <div className="relative z-10">
                <span className="text-[10px] font-mono font-bold tracking-widest text-amber-400 uppercase bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
                  BOSS SLAYED ⚔️
                </span>

                <div className="text-5xl my-4 select-none animate-bounce">
                  🏆🔥💀
                </div>

                <h3 className="text-xl font-extrabold font-display text-white mt-2">
                  🏆 전방의 수문장 [{bossClearCelebration.bossName}] 격퇴 성공!
                </h3>
                
                <p className="text-xs text-slate-400 max-w-xs mx-auto mt-2 leading-relaxed">
                  위대한 집중 역사의 업적 <span className="text-yellow-400 font-semibold font-display">[{bossClearCelebration.achievementName}]</span> 공적을 세워 관문의 보스를 통쾌하게 무찔렀습니다!
                </p>

                <div className="bg-slate-950/80 p-4 rounded-2xl border border-amber-500/20 my-5 text-xs text-left max-w-sm mx-auto space-y-2">
                  <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-widest font-bold">Loot Drop (보스 토벌 기념 전리품)</span>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">보스 처단 하사 상금:</span>
                    <span className="text-yellow-400 font-bold text-sm font-mono flex items-center gap-0.5">
                      +{bossClearCelebration.coinsReward} 🪙
                    </span>
                  </div>
                  {bossClearCelebration.titleReward && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">전설의 모험가 칭호 각인:</span>
                      <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-400/20 px-2 py-0.5 rounded font-bold font-display text-[10px]">
                        🏆 [{bossClearCelebration.titleReward}]
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      if (bossClearCelebration.titleReward) {
                        handleEquipTitle(bossClearCelebration.titleReward);
                      }
                      setBossClearCelebration(null);
                    }}
                    className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs py-3 rounded-xl cursor-pointer transition-colors shadow-lg"
                  >
                    👑 즉시 신규 어록 왕관 장착
                  </button>
                  <button
                    onClick={() => setBossClearCelebration(null)}
                    className="flex-1 bg-indigo-800 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl cursor-pointer transition-colors"
                  >
                    확인 및 복귀
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
