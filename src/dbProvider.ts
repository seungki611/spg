import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Profile, StudySession, UserAchievement, UserTitle, RankingItem, ACHIEVEMENTS } from './types';

// Mock rivals to make the leaderboard alive and engaging even with a clean database or locally!
const SEEDED_RIVALS = [
  { nickname: '독서실요정 🧚‍♀️', selected_title: '집중 입문자', coins: 1420, today_min: 45, week_min: 320, total_min: 1200 },
  { nickname: '프로밤샘러 ☕', selected_title: '공부 전사', coins: 3450, today_min: 130, week_min: 680, total_min: 2400 },
  { nickname: '코인사냥꾼 🪙', selected_title: '기말고사 정복자', coins: 12500, today_min: 190, week_min: 980, total_min: 6200 },
  { nickname: '공신이승기 🎓', selected_title: '중간고사 사냥꾼', coins: 4800, today_min: 80, week_min: 440, total_min: 3100 },
  { nickname: '수능만점스나이퍼 🎯', selected_title: '수능 정복자', coins: 28900, today_min: 240, week_min: 1400, total_min: 18400 },
  { nickname: '열공마스터 ⚡', selected_title: '전설의 학습자', coins: 65200, today_min: 310, week_min: 1980, total_min: 33400 }
];

// Helper to generate UUIDs in Local Mode
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Safe in-memory storage fallback for restricted iframe environment
const memoryCache: Record<string, string> = {};

function getLocalItem<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.warn(`localStorage blocked when fetching '${key}'. Using in-memory fallback.`, e);
    const cached = memoryCache[key];
    return cached ? JSON.parse(cached) : defaultValue;
  }
}

function setLocalItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`localStorage blocked when saving '${key}'. Using in-memory fallback.`, e);
    memoryCache[key] = JSON.stringify(value);
  }
}

export class DBProvider {
  // Is Supabase active
  static isSupabase() {
    try {
      // Support manual bypass to fallback mode when hitting email limits or confirmation restrictions
      const forceLocal = localStorage.getItem('quest_force_local_mode');
      if (forceLocal === 'true') {
        return false;
      }
    } catch (e) {
      // safe fallback if localStorage is blocked
    }
    return isSupabaseConfigured && supabase !== null;
  }

  // --- Auth Utilities ---
  static async getCurrentUser() {
    if (this.isSupabase()) {
      try {
        const { data: { user }, error } = await supabase!.auth.getUser();
        if (error) {
          if (error.message && (error.message.includes('session missing') || error.message.includes('Auth session missing'))) {
            console.log('No active session found during initialization (user not logged in).');
          } else {
            console.warn('Supabase get user failed:', error);
          }
          return null;
        }
        return user;
      } catch (err: any) {
        if (err.message && (err.message.includes('session missing') || err.message.includes('Auth session missing'))) {
          console.log('No active session found during initialization.');
        } else {
          console.warn('Unexpected error in getCurrentUser:', err);
        }
        return null;
      }
    } else {
      const activeId = getLocalItem<string | null>('quest_current_user_id', null);
      if (!activeId) return null;
      const users = getLocalItem<any[]>('quest_users', []);
      const user = users.find(u => u.id === activeId);
      return user ? { id: user.id, email: user.email } : null;
    }
  }

  static async signUp(email: string, password: string, nickname: string) {
    if (this.isSupabase()) {
      // 1. Sign up user
      const { data, error } = await supabase!.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error('User sign up failed in Supabase');

      // 2. Create profile
      const { error: profileError } = await supabase!.from('profiles').insert({
        id: data.user.id,
        nickname: nickname,
        coins: 0,
        selected_title: '첫걸음 학습자'
      });
      if (profileError) {
        console.error('Profile creation error:', profileError);
      }

      // 3. Give default title '첫걸음 학습자'
      const { error: titleError } = await supabase!.from('user_titles').insert({
        user_id: data.user.id,
        title: '첫걸음 학습자'
      });
      if (titleError) {
        console.error('Title creation error:', titleError);
      }

      return data.user;
    } else {
      const users = getLocalItem<any[]>('quest_users', []);
      if (users.some(u => u.email === email)) {
        throw new Error('이미 등록된 이메일 주소입니다.');
      }
      const newUserId = generateUUID();
      const newUser = { id: newUserId, email, password, nickname };
      users.push(newUser);
      setLocalItem('quest_users', users);

      // Create profile
      const profiles = getLocalItem<Record<string, Profile>>('quest_profiles', {});
      profiles[newUserId] = {
        id: newUserId,
        nickname,
        coins: 0,
        selected_title: '첫걸음 학습자',
        created_at: new Date().toISOString()
      };
      setLocalItem('quest_profiles', profiles);

      // Add user titles
      const userTitles = getLocalItem<UserTitle[]>('quest_titles', []);
      userTitles.push({
        id: generateUUID(),
        user_id: newUserId,
        title: '첫걸음 학습자',
        created_at: new Date().toISOString()
      });
      setLocalItem('quest_titles', userTitles);

      // Auto login after sign up
      setLocalItem('quest_current_user_id', newUserId);
      return { id: newUserId, email };
    }
  }

  static async signIn(email: string, password: string) {
    if (this.isSupabase()) {
      const { data, error } = await supabase!.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data.user;
    } else {
      const users = getLocalItem<any[]>('quest_users', []);
      const user = users.find(u => u.email === email && u.password === password);
      if (!user) {
        throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
      }
      setLocalItem('quest_current_user_id', user.id);
      return { id: user.id, email: user.email };
    }
  }

  static async signOut() {
    if (this.isSupabase()) {
      const { error } = await supabase!.auth.signOut();
      if (error) throw error;
    } else {
      try {
        localStorage.removeItem('quest_current_user_id');
      } catch (e) {
        delete memoryCache['quest_current_user_id'];
      }
    }
  }

  // --- Profile Queries ---
  static async getProfile(userId: string): Promise<Profile | null> {
    if (this.isSupabase()) {
      const { data, error } = await supabase!
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      return data;
    } else {
      const profiles = getLocalItem<Record<string, Profile>>('quest_profiles', {});
      return profiles[userId] || null;
    }
  }

  static async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
    if (this.isSupabase()) {
      const { data, error } = await supabase!
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const profiles = getLocalItem<Record<string, Profile>>('quest_profiles', {});
      if (!profiles[userId]) {
        throw new Error('Profile does not exist');
      }
      profiles[userId] = { ...profiles[userId], ...updates };
      setLocalItem('quest_profiles', profiles);
      return profiles[userId];
    }
  }

  // --- Study Sessions Queries ---
  static async getStudySessions(userId: string): Promise<StudySession[]> {
    if (this.isSupabase()) {
      const { data, error } = await supabase!
        .from('study_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } else {
      const sessions = getLocalItem<StudySession[]>('quest_sessions', []);
      return sessions
        .filter(s => s.user_id === userId)
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    }
  }

  static async addStudySession(
    userId: string,
    startedAt: string,
    endedAt: string,
    durationMinutes: number,
    earnedCoins: number
  ): Promise<StudySession> {
    if (this.isSupabase()) {
      // Begin transaction-like sequence
      // 1. Save study session
      const { data, error } = await supabase!
        .from('study_sessions')
        .insert({
          user_id: userId,
          started_at: startedAt,
          ended_at: endedAt,
          duration_minutes: durationMinutes,
          earned_coins: earnedCoins
        })
        .select()
        .single();
      if (error) throw error;

      // 2. Fetch profile to award coins
      const profile = await this.getProfile(userId);
      if (profile) {
        const currentCoins = profile.coins || 0;
        await this.updateProfile(userId, { coins: currentCoins + earnedCoins });
      }

      return data;
    } else {
      const sessions = getLocalItem<StudySession[]>('quest_sessions', []);
      const newSession: StudySession = {
        id: generateUUID(),
        user_id: userId,
        started_at: startedAt,
        ended_at: endedAt,
        duration_minutes: durationMinutes,
        earned_coins: earnedCoins,
        created_at: new Date().toISOString()
      };
      sessions.push(newSession);
      setLocalItem('quest_sessions', sessions);

      // Increase user coins
      const profiles = getLocalItem<Record<string, Profile>>('quest_profiles', {});
      if (profiles[userId]) {
        profiles[userId].coins = (profiles[userId].coins || 0) + earnedCoins;
        setLocalItem('quest_profiles', profiles);
      }

      return newSession;
    }
  }

  // --- Achievements & Titles Queries ---
  static async getAchievements(userId: string): Promise<UserAchievement[]> {
    if (this.isSupabase()) {
      const { data, error } = await supabase!
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      return data || [];
    } else {
      const achievements = getLocalItem<UserAchievement[]>('quest_achievements', []);
      return achievements.filter(a => a.user_id === userId);
    }
  }

  static async unlockAchievement(
    userId: string,
    achievementKey: string,
    rewardCoins: number,
    rewardTitle?: string
  ): Promise<boolean> {
    if (this.isSupabase()) {
      try {
        // 1. Insert achievement
        const { error: achievementError } = await supabase!
          .from('user_achievements')
          .insert({
            user_id: userId,
            achievement_key: achievementKey
          });
        if (achievementError && achievementError.code === '23505') {
          // Already unlocked
          return false;
        } else if (achievementError) {
          throw achievementError;
        }

        // 2. Insert title if available
        if (rewardTitle) {
          const { error: titleError } = await supabase!
            .from('user_titles')
            .insert({
              user_id: userId,
              title: rewardTitle
            });
          // Duplicate titles are fine, handled by unique constraint or ignored
          if (titleError && titleError.code !== '23505') {
            console.error('Error adding title:', titleError);
          }
        }

        // 3. Grant coins reward
        const profile = await this.getProfile(userId);
        if (profile) {
          await this.updateProfile(userId, { coins: (profile.coins || 0) + rewardCoins });
        }
        return true;
      } catch (err) {
        console.error('Failed to unlock achievement:', err);
        return false;
      }
    } else {
      const achievements = getLocalItem<UserAchievement[]>('quest_achievements', []);
      const isAlready = achievements.some(a => a.user_id === userId && a.achievement_key === achievementKey);
      if (isAlready) return false;

      achievements.push({
        id: generateUUID(),
        user_id: userId,
        achievement_key: achievementKey,
        achieved_at: new Date().toISOString()
      });
      setLocalItem('quest_achievements', achievements);

      // Add profile coins
      const profiles = getLocalItem<Record<string, Profile>>('quest_profiles', {});
      if (profiles[userId]) {
        profiles[userId].coins = (profiles[userId].coins || 0) + rewardCoins;
        setLocalItem('quest_profiles', profiles);
      }

      // Add Title
      if (rewardTitle) {
        const titles = getLocalItem<UserTitle[]>('quest_titles', []);
        const alreadyHasTitle = titles.some(t => t.user_id === userId && t.title === rewardTitle);
        if (!alreadyHasTitle) {
          titles.push({
            id: generateUUID(),
            user_id: userId,
            title: rewardTitle,
            created_at: new Date().toISOString()
          });
          setLocalItem('quest_titles', titles);
        }
      }

      return true;
    }
  }

  static async getTitles(userId: string): Promise<UserTitle[]> {
    if (this.isSupabase()) {
      const { data, error } = await supabase!
        .from('user_titles')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      return data || [];
    } else {
      const titles = getLocalItem<UserTitle[]>('quest_titles', []);
      return titles.filter(t => t.user_id === userId);
    }
  }

  // --- Leaderboard Queries ---
  static async getRankings(
    userId: string,
    currentProfile: Profile | null,
    todayMinutes: number,
    weeklyMinutes: number,
    totalMinutes: number,
    type: 'today' | 'week' | 'total' | 'coins'
  ): Promise<RankingItem[]> {
    if (!currentProfile) return [];

    let rawRankings: { nickname: string; selected_title: string; value: number; is_user: boolean }[] = [];

    if (this.isSupabase()) {
      try {
        // Since Supabase study_sessions must be calculated per user,
        // we can fetch active profiles and join/aggregate,
        // but since we are client-side only without complicated views,
        // let's do a reliable client-side aggregation or fetch profiles and overlay
        // seeded rivals to offer an outstanding fully functional game feeling.
        // Let's grab all profiles from Supabase first
        const { data: profiles, error } = await supabase!
          .from('profiles')
          .select('id, nickname, coins, selected_title');

        if (error) throw error;

        // For durations, we fetch all study sessions to aggregate,
        // but to prevent large queries we can also aggregate or use the profile's relative values
        // or support dynamic calculations. Let's do dynamic calculations!
        const { data: sessions, error: sessionsError } = await supabase!
          .from('study_sessions')
          .select('user_id, duration_minutes, started_at');

        if (sessionsError) throw sessionsError;

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        // Calculate start of this week (Monday)
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(now.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfWeekTime = startOfWeek.getTime();

        const userAggregations: Record<string, { today: number; week: number; total: number }> = {};

        // Loop study sessions to aggregate
        if (sessions) {
          sessions.forEach(s => {
            const time = new Date(s.started_at).getTime();
            const mins = s.duration_minutes;
            const uid = s.user_id;

            if (!userAggregations[uid]) {
              userAggregations[uid] = { today: 0, week: 0, total: 0 };
            }

            userAggregations[uid].total += mins;
            if (time >= startOfToday) {
              userAggregations[uid].today += mins;
            }
            if (time >= startOfWeekTime) {
              userAggregations[uid].week += mins;
            }
          });
        }

        // Map profiles to items
        rawRankings = (profiles || []).map(p => {
          const stats = userAggregations[p.id] || { today: 0, week: 0, total: 0 };
          let scoreVal = 0;
          if (type === 'today') {
            scoreVal = p.id === userId ? todayMinutes : stats.today;
          } else if (type === 'week') {
            scoreVal = p.id === userId ? weeklyMinutes : stats.week;
          } else if (type === 'total') {
            scoreVal = p.id === userId ? totalMinutes : stats.total;
          } else if (type === 'coins') {
            scoreVal = p.coins;
          }

          return {
            nickname: p.nickname,
            selected_title: p.selected_title || '첫걸음 학습자',
            value: scoreVal,
            is_user: p.id === userId
          };
        });

      } catch (err) {
        console.error('Supabase rankings aggregate failed, falling back to overlay:', err);
      }
    } else {
      // Local Mode query database
      const profiles = getLocalItem<Record<string, Profile>>('quest_profiles', {});
      const sessions = getLocalItem<StudySession[]>('quest_sessions', []);

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(now.setDate(diff));
      startOfWeek.setHours(0, 0, 0, 0);
      const startOfWeekTime = startOfWeek.getTime();

      rawRankings = Object.values(profiles).map(p => {
        const uSessions = sessions.filter(s => s.user_id === p.id);
        const localStats = {
          today: uSessions.filter(s => new Date(s.started_at).getTime() >= startOfToday).reduce((sum, s) => sum + s.duration_minutes, 0),
          week: uSessions.filter(s => new Date(s.started_at).getTime() >= startOfWeekTime).reduce((sum, s) => sum + s.duration_minutes, 0),
          total: uSessions.reduce((sum, s) => sum + s.duration_minutes, 0)
        };

        let scoreVal = 0;
        if (type === 'today') {
          scoreVal = p.id === userId ? todayMinutes : localStats.today;
        } else if (type === 'week') {
          scoreVal = p.id === userId ? weeklyMinutes : localStats.week;
        } else if (type === 'total') {
          scoreVal = p.id === userId ? totalMinutes : localStats.total;
        } else if (type === 'coins') {
          scoreVal = p.coins;
        }

        return {
          nickname: p.nickname,
          selected_title: p.selected_title || '첫걸음 학습자',
          value: scoreVal,
          is_user: p.id === userId
        };
      });
    }

    // Always merge in our pre-seeded active rivals to populate the tables beautifully!
    // This provides a delightful gaming feeling, showing high rankings and motivating users.
    const mergedList = [...rawRankings];

    SEEDED_RIVALS.forEach(rival => {
      // Avoid duplicate nicknames if any
      if (!mergedList.some(r => r.nickname === rival.nickname)) {
        let rivalVal = 0;
        if (type === 'today') rivalVal = rival.today_min;
        else if (type === 'week') rivalVal = rival.week_min;
        else if (type === 'total') rivalVal = rival.total_min;
        else if (type === 'coins') rivalVal = rival.coins;

        mergedList.push({
          nickname: rival.nickname,
          selected_title: rival.selected_title,
          value: rivalVal,
          is_user: false
        });
      }
    });

    // Sort by value descending and calculate rank
    mergedList.sort((a, b) => b.value - a.value);

    // Apply numerical rank (same positions for tie-breakers)
    return mergedList.map((item, index) => ({
      rank: index + 1,
      ...item
    }));
  }
}
