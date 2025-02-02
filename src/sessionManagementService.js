// sessionManagementService.js
import { supabase } from '../lib/supabaseClient';

class SessionManagementService {
    constructor(storageType = 'sessionStorage') {
        if (typeof window !== 'undefined') {
            this.storage = window[storageType];
        } else {
            this.storage = null;
        }
    }

    async createProspectSession() {
        try {
            const { data, error } = await supabase
                .from('sessions')
                .insert([{
                    status: 'prospect',
                    current_step: 1,
                    started_at: new Date().toISOString(),
                    last_activity: new Date().toISOString(),
                    version: 1
                }])
                .select()
                .single();

            if (error) throw error;

            this.saveData('currentSessionId', data.id);
            return data.id;
        } catch (error) {
            console.error('Error creating prospect session:', error);
            throw error;
        }
    }

    async activateSession(sessionId, pin, userData = {}) {
        try {
            const { data, error } = await supabase
                .from('sessions')
                .update({
                    pin,
                    status: 'active',
                    form_data: userData,
                    last_activity: new Date().toISOString()
                })
                .eq('id', sessionId)
                .eq('status', 'prospect')
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error activating session:', error);
            throw error;
        }
    }

    async completeExistingSessions(pin) {
        try {
            const { data: existingSessions, error } = await supabase
                .from('sessions')
                .select('*')
                .eq('pin', pin)
                .eq('status', 'active');

            if (error) throw error;

            if (existingSessions?.length > 0) {
                const updates = existingSessions.map(session => ({
                    id: session.id,
                    status: 'completed',
                    completed_at: new Date().toISOString()
                }));

                const { error: updateError } = await supabase
                    .from('sessions')
                    .upsert(updates);

                if (updateError) throw updateError;
            }
        } catch (error) {
            console.error('Error completing existing sessions:', error);
            throw error;
        }
    }

    async getCurrentSession() {
        try {
            const sessionId = this.getData('currentSessionId');
            if (!sessionId) return null;

            const { data, error } = await supabase
                .from('sessions')
                .select('*')
                .eq('id', sessionId)
                .in('status', ['active', 'prospect'])
                .single();

            if (error) {
                if (error.code === 'PGRST116') return null;
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error getting current session:', error);
            return null;
        }
    }

    async updateSession(sessionId, updates) {
        try {
            const { error } = await supabase
                .from('sessions')
                .update({
                    ...updates,
                    last_activity: new Date().toISOString()
                })
                .eq('id', sessionId)
                .in('status', ['active', 'prospect']);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating session:', error);
            throw error;
        }
    }

    async completeSession(sessionId) {
        try {
            const { data: session, error: checkError } = await supabase
                .from('sessions')
                .select('*')
                .eq('id', sessionId)
                .single();

            if (checkError) throw checkError;

            if (!session) {
                console.warn('No active session found to complete');
                return;
            }

            const { error } = await supabase
                .from('sessions')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', sessionId);

            if (error) throw error;

            this.clearAllData();
        } catch (error) {
            console.error('Error completing session:', error);
            throw error;
        }
    }

    async abandonSession(sessionId, reason) {
        try {
            const { error } = await supabase
                .from('sessions')
                .update({
                    status: 'abandoned',
                    error_message: reason,
                    completed_at: new Date().toISOString()
                })
                .eq('id', sessionId)
                .in('status', ['active', 'prospect']);

            if (error) throw error;
            this.clearAllData();
        } catch (error) {
            console.error('Error abandoning session:', error);
            throw error;
        }
    }

    async handlePinChange(newPin) {
        try {
            const currentSessionId = this.getData('currentSessionId');
    
            // Check for existing active session with different PIN
            const { data, error } = await supabase
                .from('sessions')
                .select('*')
                .eq('status', 'active')
                .neq('id', currentSessionId)
                .neq('pin', newPin);
    
            if (error) {
                // If error is "no rows returned", that's actually okay
                if (error.code === 'PGRST116') {
                    return null;
                }
                throw error;
            }
    
            // If we found any sessions, return the first one
            return data && data.length > 0 ? data[0] : null;
        } catch (error) {
            console.error('Error checking existing session:', error);
            throw error;
        }
    }

    async isSessionActive(sessionId) {
        try {
            const { data, error } = await supabase
                .from('sessions')
                .select('created_at, last_activity')
                .eq('id', sessionId)
                .single();
    
            if (error) throw error;
    
            const lastActivity = new Date(data.last_activity);
            const now = new Date();
            const diffMinutes = (now - lastActivity) / (1000 * 60);
    
            return diffMinutes <= 5;
        } catch (error) {
            console.error('Error checking session activity:', error);
            return false;
        }
    }

    async isSessionExpired(sessionId) {
        try {
            const { data, error } = await supabase
                .from('sessions')
                .select('last_activity')
                .eq('id', sessionId)
                .single();

            if (error) throw error;

            const lastActivity = new Date(data.last_activity);
            const now = new Date();
            const diffMinutes = (now - lastActivity) / (1000 * 60);

            return diffMinutes > 30;
        } catch (error) {
            console.error('Error checking session expiry:', error);
            return true;
        }
    }

    saveData(key, data) {
        try {
            if (this.storage) {
                this.storage.setItem(key, JSON.stringify(data));
            }
        } catch (error) {
            console.error('Error saving session data:', error);
        }
    }

    setData(key, data) {
        return this.saveData(key, data);
    }

    getData(key) {
        if (!this.storage) return null;
        try {
            const data = this.storage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error getting data:', error);
            return null;
        }
    }

    removeData(key) {
        if (!this.storage) return;
        try {
            this.storage.removeItem(key);
        } catch (error) {
            console.error('Error removing data:', error);
        }
    }

    clearAllData() {
        if (!this.storage) return;
        try {
                this.storage.clear();
        } catch (error) {
            console.error('Error clearing data:', error);
        }
    }
}

export default SessionManagementService;