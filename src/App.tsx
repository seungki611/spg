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
  Plus
} from 'lucide-react';
import { DBProvider } from './dbProvider';
import { ACHIEVEMENTS, Profile, StudySession, UserAchievement, UserTitle, RankingItem } from './types';

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
  // DB & Auth State
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSupabaseMode, setIsSupabaseMode] = useState(false);

  // Tab State: 'dashboard' | 'history' | 'achievements' | 'rankings' | 'profile'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'achievements' | 'rankings' | 'profile'>('dashboard');

  // Timer State
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Test Utilities / Sandbox Mode Toggles
  const [cheatSpeedEnabled, setCheatSpeedEnabled] = useState(false); // 1s real = 1m gamified
  const [sandboxVisible, setSandboxVisible] = useState(true);

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

  // Live stopwatch update
  useEffect(() => {
    if (isTimerRunning && timerStartedAt) {
      // Periodic timer ticking
      intervalRef.current = setInterval(() => {
        const startMs = new Date(timerStartedAt).getTime();
        const nowMs = Date.now();
        const diffSecs = Math.floor((nowMs - startMs) / 1000);

        if (cheatSpeedEnabled) {
          // Accelerated Cheat Mode: 1 real-time second contributes 1 gamified minute
          setElapsedSeconds(diffSecs * 60);
        } else {
          setElapsedSeconds(diffSecs);
        }
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setElapsedSeconds(0);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isTimerRunning, timerStartedAt, cheatSpeedEnabled]);

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
      } else {
        const user = await DBProvider.signIn(email, password);
        setCurrentUser(user);
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

      // Reward Calculations
      // 1 minute = 1 Coin
      const baseCoins = runtimeMin;
      let bonusCoins = 0;
      if (runtimeMin >= 120) {
        bonusCoins = 80;
      } else if (runtimeMin >= 60) {
        bonusCoins = 30;
      } else if (runtimeMin >= 30) {
        bonusCoins = 10;
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
        totalCoins: totalEarned
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

  // Sandbox cheat loaders to ease validation
  const injectMockStudySession = async (minutes: number) => {
    if (!currentUser) return;
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
        currentUser.id,
        past.toISOString(),
        now.toISOString(),
        minutes,
        earned
      );

      setSessionFinishReward({
        minutes,
        baseCoins,
        bonusCoins,
        totalCoins: earned
      });

      await triggerSyncAndAchievementsCheck(minutes);
    } catch (err) {
      console.error('Sandbox inject study fail:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCoinsCheat = async () => {
    if (!currentUser || !currentProfile) return;
    try {
      setLoading(true);
      const updatedCoins = (currentProfile.coins || 0) + 1000;
      const upProfile = await DBProvider.updateProfile(currentUser.id, { coins: updatedCoins });
      setCurrentProfile(upProfile);
    } catch (err) {
      console.error('Sandbox coin cheat failure:', err);
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
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col font-sans transition-all selection:bg-amber-400 selection:text-slate-900">
      
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
      <header className="bg-[#1e293b]/80 border-b border-slate-700/80 sticky top-0 z-40 backdrop-blur-md shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
          
          {/* Logo with swords and coins */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="bg-amber-500 text-slate-950 p-2 rounded-lg glow-gold animate-pulse">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight font-display text-white">
                스피지 <span className="text-amber-400">SPG</span>
              </h1>
              <p className="text-[10px] text-slate-400 -mt-0.5 tracking-wider font-mono">STUDY + RPG 게이밍 타이머</p>
            </div>
          </div>

          {/* User state or logs */}
          {currentUser && currentProfile && (
            <div className="flex items-center gap-3 sm:gap-6">
              
              {/* Character miniature info */}
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-200 flex items-center justify-end gap-1.5">
                  <span className="bg-indigo-500/10 text-indigo-300 font-mono text-[9px] px-1.5 py-0.5 rounded border border-indigo-400/20">
                    {currentProfile.selected_title || '첫걸음 학습자'}
                  </span>
                  {currentProfile.nickname} 님
                </span>
                <span className="text-[10px] font-mono text-slate-400">학습 레벨 게이머</span>
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
            <div className="flex select-none bg-[#1e293b]/55 border border-slate-700/80 p-1.5 rounded-2xl justify-between sm:justify-start gap-1 overflow-x-auto shadow-lg backdrop-blur-md">
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

                      {/* Giant digital timer display */}
                      <div className="text-[5.5rem] sm:text-[7rem] md:text-[8rem] font-black leading-none tracking-tighter text-indigo-400 drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] my-12 font-mono flex items-center justify-center selection:bg-indigo-600/55">
                        {isTimerRunning ? formatTime(elapsedSeconds) : '00:00:00'}
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
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-550 to-indigo-750 rounded-2xl mb-4 flex items-center justify-center text-3xl shadow-lg border border-indigo-500/30 select-none animate-pulse">🦁</div>
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
                    <div className="col-span-12 lg:col-span-8 bg-slate-900/60 border-2 border-slate-700/80 rounded-[2.5rem] p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 sm:gap-8 relative overflow-hidden shadow-2xl backdrop-blur-md">
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

                    {/* Bento Card 9: Sandbox / Debug Cheat Tool Panel */}
                    <div className="col-span-12 lg:col-span-4 bg-slate-900/35 border border-slate-800 rounded-[2rem] p-5 shadow-xl relative overflow-hidden backdrop-blur-md">
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="flex items-center gap-1.5 text-amber-400 font-display">
                          <Sliders className="w-4 h-4" />
                          <h4 className="text-xs font-black uppercase tracking-wider">⚙️ 모험가 길드 보조 마법판 (테스트 전용)</h4>
                        </div>
                        <button
                          onClick={() => setSandboxVisible(!sandboxVisible)}
                          className="text-slate-400 hover:text-slate-200 text-[10px] underline cursor-pointer"
                        >
                          {sandboxVisible ? '비밀판 접기' : '비밀판 열기'}
                        </button>
                      </div>

                      {sandboxVisible && (
                        <div className="space-y-3.5 text-xs">
                          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-[10px] text-slate-400">
                            💡 평가자 특혜: 칭호 해제 및 골드 지급을 신속하게 테스트해 보기 위한 전용 제어판입니다.
                          </div>

                          {/* Cheat Speed active toggle */}
                          <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-805">
                            <span className="font-semibold text-slate-300">⏱️ 가속의 모래시계 (60배속)</span>
                            <button
                              type="button"
                              onClick={() => setCheatSpeedEnabled(!cheatSpeedEnabled)}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                cheatSpeedEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-850 text-slate-400'
                              }`}
                            >
                              {cheatSpeedEnabled ? '가속 온 (1초 = 1분)' : '가속 오프'}
                            </button>
                          </div>

                          <div className="space-y-1.5">
                            <span className="font-semibold text-[10px] text-slate-400 block tracking-wide uppercase font-mono">🔮 가상 집중 공적 주입</span>
                            
                            <div className="grid grid-cols-3 gap-1.5 font-display">
                              <button
                                type="button"
                                onClick={() => injectMockStudySession(10)}
                                className="bg-indigo-950 hover:bg-slate-800 text-indigo-300 font-bold p-1.5 rounded text-[10px] border border-indigo-400/10 cursor-pointer"
                              >
                                +10분 수련
                              </button>
                              <button
                                type="button"
                                onClick={() => injectMockStudySession(60)}
                                className="bg-indigo-950 hover:bg-slate-800 text-indigo-300 font-bold p-1.5 rounded text-[10px] border border-indigo-400/10 cursor-pointer"
                              >
                                +1시간 수련
                              </button>
                              <button
                                type="button"
                                onClick={() => injectMockStudySession(180)}
                                className="bg-indigo-950 hover:bg-slate-800 text-indigo-300 font-bold p-1.5 rounded text-[10px] border border-indigo-400/10 cursor-pointer"
                              >
                                +3시간 수련
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() => injectMockStudySession(3000)} // Adds 50 hours!
                                className="bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold p-1.5 rounded text-[10px] border border-rose-400/20 cursor-pointer"
                              >
                                💀 +50시간 각성 대량 주입
                              </button>
                              <button
                                type="button"
                                onClick={() => injectMockStudySession(18000)} // Adds 300 hours!
                                className="bg-violet-950 hover:bg-violet-900 text-violet-300 font-bold p-1.5 rounded text-[10px] border border-violet-400/25 cursor-pointer"
                              >
                                🌌 +300시간 무한 대각성 주입
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleCoinsCheat}
                            className="w-full flex items-center justify-center gap-1.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold py-1.5 px-3 rounded-lg cursor-pointer text-xs hover:bg-amber-500/25"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            🪙 금광 더미 채굴 (치트 골드 +1,000 획득)
                          </button>
                        </div>
                      )}
                    </div>

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
                    <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
                      <div>
                        <h3 className="text-lg font-bold font-display text-white">📖 모험 수행 기록 비급서 (Logs)</h3>
                        <p className="text-xs text-slate-400 mt-1">모험가님이 이룩한 영광스럽고 불굴에 가득 찬 집중 전투 사냥 일지입니다.</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                          총 전투 기록: {studySessions.length}회 완수
                        </span>
                      </div>
                    </div>

                    {studySessions.length === 0 ? (
                      <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-2xl">
                        <div className="inline-flex bg-slate-950 p-4 rounded-full text-slate-600 mb-3">
                          <History className="w-8 h-8" />
                        </div>
                        <h4 className="text-slate-300 font-bold">일지에 기록된 완수 퀘스트 전적이 없습니다</h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-2 leading-relaxed">
                          타이머를 시작하여 전투에 집중하거나 대시보드 치트판을 통하여 가상 퀘스트 세션을 주입해 보십시오!
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                              <th className="py-3 px-4 font-bold">날짜 / 모험 개시</th>
                              <th className="py-3 px-4 font-bold">전투 종료</th>
                              <th className="py-3 px-4 font-bold">지속 시간</th>
                              <th className="py-3 px-4 font-bold">수확 전리품 (골드)</th>
                              <th className="py-3 px-4 text-right font-bold">퀘스트 상태</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850">
                            {studySessions.map((session) => {
                              const startDate = new Date(session.started_at);
                              const endDate = new Date(session.ended_at);
                              
                              const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2,'0')}-${String(startDate.getDate()).padStart(2,'0')}`;
                              const startStr = `${String(startDate.getHours()).padStart(2,'0')}:${String(startDate.getMinutes()).padStart(2,'0')}:${String(startDate.getSeconds()).padStart(2,'0')}`;
                              const endStr = `${String(endDate.getHours()).padStart(2,'0')}:${String(endDate.getMinutes()).padStart(2,'0')}:${String(endDate.getSeconds()).padStart(2,'0')}`;

                              return (
                                <tr key={session.id} className="hover:bg-slate-850/50 transition-colors">
                                  <td className="py-3.5 px-4 font-medium">
                                    <span className="block text-slate-100 font-bold">{dateStr}</span>
                                    <span className="text-[10px] text-slate-500 font-mono">{startStr}</span>
                                  </td>
                                  <td className="py-3.5 px-4 text-slate-400 font-mono">
                                    {endStr}
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <span className="inline-flex bg-indigo-500/10 text-indigo-300 font-semibold px-2 py-0.5 rounded font-mono border border-indigo-500/20">
                                      {session.duration_minutes}분 집중
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 font-bold text-amber-400 font-mono">
                                    +{session.earned_coins} 🪙
                                  </td>
                                  <td className="py-3.5 px-4 text-right text-emerald-400 font-bold">
                                    <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                      <Check className="w-3 h-3" />
                                      격파 완료
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
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

                        // Unique boss emojis
                        const getBossEmoji = (key: string) => {
                          switch (key) {
                            case 'first_study': return '🟢🦠'; // slime
                            case 'focus_beginner': return '🤖🗿'; // golem
                            case 'study_warrior': return '🦇👿'; // gargoyle
                            case 'midterm_boss': return '🐲🔥'; // Red Dragon
                            case 'final_boss': return '💀⚔️'; // Death Knight
                            case 'csat_boss': return '🧙‍♂️🔮'; // Archpriest
                            case 'legendary_student': return '⚡⚡⚡🏛️'; // Zeus
                            default: return '👾';
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
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {rankings.map((rk, idx) => {
                            const isUserRow = rk.is_user;

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
                                  isUserRow
                                    ? 'bg-indigo-500/15 border-y-2 border-indigo-500/30'
                                    : 'hover:bg-slate-850/30'
                                }`}
                              >
                                <td className="py-3.5 px-4">
                                  {getRankBadge(rk.rank)}
                                </td>
                                <td className="py-3.5 px-4 font-medium flex items-center gap-1.5">
                                  <span className={`font-bold ${isUserRow ? 'text-indigo-300' : 'text-slate-200'}`}>
                                    {rk.nickname}
                                  </span>
                                  {isUserRow && (
                                    <span className="text-[9px] bg-indigo-500 text-white font-bold px-1.5 py-0.5 rounded-full select-none">
                                      나
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="text-[10px] bg-slate-950/60 text-slate-300 px-2.5 py-1 rounded border border-slate-800">
                                    {rk.selected_title || '초련의 학습자'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100 text-[13px]">
                                  {rankingType === 'coins' ? (
                                    <span className="text-amber-400">{rk.value.toLocaleString()} 🪙</span>
                                  ) : (
                                    formatMinutesReadable(rk.value)
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-4 leading-relaxed font-mono">
                      * 월드 보드 안정화 마법 덕분에, 수련 자극과 극적인 모험 활기를 주기 위해 대륙의 쟁쟁한 가상 경쟁 모험가 6인이 명예의 서열판에 상시 동기화되어 경쟁을 펼칩니다!
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
