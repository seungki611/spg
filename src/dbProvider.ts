import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Profile, StudySession, UserAchievement, UserTitle, RankingItem, ACHIEVEMENTS } from './types';

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
        rawRankings = (profiles || [])
          .map(p => {
            const stats = userAggregations[p.id] || { today: 0, week: 0, total: 0 };
            const uTotal = p.id === userId ? totalMinutes : stats.total;
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
              userId: p.id,
              nickname: p.nickname,
              selected_title: p.selected_title || '첫걸음 학습자',
              value: scoreVal,
              is_user: p.id === userId,
              totalForFilter: uTotal
            };
          })
          .filter(item => item.totalForFilter > 0);

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

      rawRankings = Object.values(profiles)
        .map(p => {
          const uSessions = sessions.filter(s => s.user_id === p.id);
          const localStats = {
            today: uSessions.filter(s => new Date(s.started_at).getTime() >= startOfToday).reduce((sum, s) => sum + s.duration_minutes, 0),
            week: uSessions.filter(s => new Date(s.started_at).getTime() >= startOfWeekTime).reduce((sum, s) => sum + s.duration_minutes, 0),
            total: uSessions.reduce((sum, s) => sum + s.duration_minutes, 0)
          };

          const uTotal = p.id === userId ? totalMinutes : localStats.total;
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
            userId: p.id,
            nickname: p.nickname,
            selected_title: p.selected_title || '첫걸음 학습자',
            value: scoreVal,
            is_user: p.id === userId,
            totalForFilter: uTotal
          };
        })
        .filter(item => item.totalForFilter > 0);
    }

    // Only keep real players in the lists as requested
    const mergedList = [...rawRankings];

    // Sort by value descending and calculate rank
    mergedList.sort((a, b) => b.value - a.value);

    // Apply numerical rank (same positions for tie-breakers)
    return mergedList.map((item, index) => ({
      rank: index + 1,
      ...item
    }));
  }

  // Delete/Manage user record from leaderboard (Developer administrative tool)
  static async deleteUserRecord(targetUserId: string): Promise<boolean> {
    if (this.isSupabase()) {
      try {
        await supabase!.from('study_sessions').delete().eq('user_id', targetUserId);
        await supabase!.from('user_achievements').delete().eq('user_id', targetUserId);
        await supabase!.from('user_titles').delete().eq('user_id', targetUserId);
        const { error } = await supabase!.from('profiles').delete().eq('id', targetUserId);
        if (error) throw error;
        return true;
      } catch (err) {
        console.error('Failed to delete user in Supabase mode:', err);
        throw err;
      }
    } else {
      try {
        const profiles = getLocalItem<Record<string, Profile>>('quest_profiles', {});
        const sessions = getLocalItem<StudySession[]>('quest_sessions', []);
        const titles = getLocalItem<UserTitle[]>('quest_titles', []);
        const achievements = getLocalItem<UserAchievement[]>('quest_achievements', []);

        if (profiles[targetUserId]) {
          delete profiles[targetUserId];
          setLocalItem('quest_profiles', profiles);
        }

        const updatedSessions = sessions.filter(s => s.user_id !== targetUserId);
        setLocalItem('quest_sessions', updatedSessions);

        const updatedTitles = titles.filter(t => t.user_id !== targetUserId);
        setLocalItem('quest_titles', updatedTitles);

        const updatedAchievements = achievements.filter(a => a.user_id !== targetUserId);
        setLocalItem('quest_achievements', updatedAchievements);

        // Also clean up quest_users
        const users = getLocalItem<any[]>('quest_users', []);
        const updatedUsers = users.filter(u => u.id !== targetUserId);
        setLocalItem('quest_users', updatedUsers);

        return true;
      } catch (err) {
        console.error('Failed to delete user in Local mode:', err);
        throw err;
      }
    }
  }

  // Fetch detailed info of all users for developer panel
  static async getAllUsersAdminData(): Promise<any[]> {
    if (this.isSupabase()) {
      try {
        const { data: profiles, error: pErr } = await supabase!
          .from('profiles')
          .select('id, nickname, coins, selected_title, created_at');
        if (pErr) throw pErr;

        const { data: sessions, error: sErr } = await supabase!
          .from('study_sessions')
          .select('user_id, duration_minutes');
        if (sErr) throw sErr;

        const { data: titles, error: tErr } = await supabase!
          .from('user_titles')
          .select('user_id, title');
        if (tErr) throw tErr;

        return (profiles || []).map(p => {
          const userSessions = (sessions || []).filter(s => s.user_id === p.id);
          const totalMins = userSessions.reduce((sum, s) => sum + s.duration_minutes, 0);
          const userTitles = (titles || []).filter(t => t.user_id === p.id).map(t => t.title);
          
          return {
            id: p.id,
            nickname: p.nickname,
            coins: p.coins || 0,
            selected_title: p.selected_title || '첫걸음 학습자',
            total_minutes: totalMins,
            session_count: userSessions.length,
            titles_list: Array.from(new Set(['초련의 학습자', ...userTitles])),
            created_at: p.created_at
          };
        });
      } catch (err) {
        console.error('getAllUsersAdminData Supabase failed:', err);
        // Fallback to local if something fails so we have an uninterrupted experience
        const profiles = getLocalItem<Record<string, Profile>>('quest_profiles', {});
        return Object.values(profiles).map(p => ({
          id: p.id,
          nickname: p.nickname,
          coins: p.coins || 0,
          selected_title: p.selected_title || '첫걸음 학습자',
          total_minutes: 0,
          session_count: 0,
          titles_list: ['초련의 학습자'],
          created_at: p.created_at
        }));
      }
    } else {
      const profiles = getLocalItem<Record<string, Profile>>('quest_profiles', {});
      const sessions = getLocalItem<StudySession[]>('quest_sessions', []);
      const titles = getLocalItem<UserTitle[]>('quest_titles', []);

      return Object.values(profiles).map(p => {
        const userSessions = sessions.filter(s => s.user_id === p.id);
        const totalMins = userSessions.reduce((sum, s) => sum + s.duration_minutes, 0);
        const userTitles = titles.filter(t => t.user_id === p.id).map(t => t.title);

        return {
          id: p.id,
          nickname: p.nickname,
          coins: p.coins || 0,
          selected_title: p.selected_title || '첫걸음 학습자',
          total_minutes: totalMins,
          session_count: userSessions.length,
          titles_list: Array.from(new Set(['초련의 학습자', ...userTitles])),
          created_at: p.created_at
        };
      });
    }
  }

  // Admin Grant Coins
  static async grantCoinsToUser(targetUserId: string, coinsAmount: number): Promise<boolean> {
    if (this.isSupabase()) {
      try {
        const { data: profile, error: fetchErr } = await supabase!
          .from('profiles')
          .select('coins')
          .eq('id', targetUserId)
          .single();
        if (fetchErr) throw fetchErr;

        const currentCoins = profile?.coins || 0;
        const { error } = await supabase!
          .from('profiles')
          .update({ coins: currentCoins + coinsAmount })
          .eq('id', targetUserId);
        if (error) throw error;
        return true;
      } catch (err) {
        console.error('Failed to grant coins to user in Supabase:', err);
        throw err;
      }
    } else {
      const profiles = getLocalItem<Record<string, Profile>>('quest_profiles', {});
      if (profiles[targetUserId]) {
        profiles[targetUserId].coins = (profiles[targetUserId].coins || 0) + coinsAmount;
        setLocalItem('quest_profiles', profiles);
        return true;
      }
      return false;
    }
  }

  // Admin Grant Time (injects a study session)
  static async grantTimeToUser(targetUserId: string, minutesAmount: number): Promise<boolean> {
    if (this.isSupabase()) {
      try {
        const newSession = {
          user_id: targetUserId,
          started_at: new Date(Date.now() - minutesAmount * 60000).toISOString(),
          ended_at: new Date().toISOString(),
          duration_minutes: minutesAmount,
          earned_coins: 0,
          created_at: new Date().toISOString()
        };
        const { error } = await supabase!
          .from('study_sessions')
          .insert(newSession);
        if (error) throw error;
        return true;
      } catch (err) {
        console.error('Failed to grant study hours in Supabase:', err);
        throw err;
      }
    } else {
      const sessions = getLocalItem<StudySession[]>('quest_sessions', []);
      const newSession: StudySession = {
        id: 'session_' + Math.random().toString(36).substring(2, 9),
        user_id: targetUserId,
        started_at: new Date(Date.now() - minutesAmount * 60000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_minutes: minutesAmount,
        earned_coins: 0,
        created_at: new Date().toISOString()
      };
      sessions.push(newSession);
      setLocalItem('quest_sessions', sessions);
      return true;
    }
  }

  // Admin Reset Specific Category data
  static async adminResetCategory(targetUserId: string, category: 'today' | 'week' | 'total' | 'coins'): Promise<boolean> {
    if (this.isSupabase()) {
      try {
        if (category === 'today') {
          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          const { error } = await supabase!
            .from('study_sessions')
            .delete()
            .eq('user_id', targetUserId)
            .gte('started_at', startOfToday);
          if (error) throw error;
        } else if (category === 'week') {
          const now = new Date();
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          const startOfWeek = new Date(now.setDate(diff));
          startOfWeek.setHours(0, 0, 0, 0);
          const { error } = await supabase!
            .from('study_sessions')
            .delete()
            .eq('user_id', targetUserId)
            .gte('started_at', startOfWeek.toISOString());
          if (error) throw error;
        } else if (category === 'total') {
          const { error } = await supabase!
            .from('study_sessions')
            .delete()
            .eq('user_id', targetUserId);
          if (error) throw error;
        } else if (category === 'coins') {
          const { error } = await supabase!
            .from('profiles')
            .update({ coins: 0 })
            .eq('id', targetUserId);
          if (error) throw error;
        }
        return true;
      } catch (err) {
        console.error('Failed to reset user category in Supabase:', err);
        throw err;
      }
    } else {
      try {
        if (category === 'coins') {
          const profiles = getLocalItem<Record<string, Profile>>('quest_profiles', {});
          if (profiles[targetUserId]) {
            profiles[targetUserId].coins = 0;
            setLocalItem('quest_profiles', profiles);
          }
        } else {
          const sessions = getLocalItem<StudySession[]>('quest_sessions', []);
          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          const startOfWeek = new Date(now.setDate(diff));
          startOfWeek.setHours(0, 0, 0, 0);
          const startOfWeekTime = startOfWeek.getTime();

          let filtered: StudySession[] = [];
          if (category === 'today') {
            filtered = sessions.filter(s => !(s.user_id === targetUserId && new Date(s.started_at).getTime() >= startOfToday));
          } else if (category === 'week') {
            filtered = sessions.filter(s => !(s.user_id === targetUserId && new Date(s.started_at).getTime() >= startOfWeekTime));
          } else if (category === 'total') {
            filtered = sessions.filter(s => s.user_id !== targetUserId);
          }
          setLocalItem('quest_sessions', filtered);
        }
        return true;
      } catch (err) {
        console.error('Failed to reset user category in Local mode:', err);
        throw err;
      }
    }
  }
}
