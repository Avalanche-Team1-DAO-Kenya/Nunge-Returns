// transactionService.js
import { supabase } from '../lib/supabaseClient';

class TransactionService {
    async createTransaction(sessionId, userId, amount) {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .insert([{
                    session_id: sessionId,
                    user_id: userId,
                    amount,
                    status: 'pending',
                    payment_method: 'mpesa',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating transaction:', error);
            throw error;
        }
    }

    async updateTransaction(transactionId, updates) {
        try {
            const { error } = await supabase
                .from('transactions')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', transactionId);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating transaction:', error);
            throw error;
        }
    }

    async completeTransaction(transactionId, mpesaCode) {
        try {
            const { error } = await supabase
                .from('transactions')
                .update({
                    status: 'completed',
                    mpesa_code: mpesaCode,
                    updated_at: new Date().toISOString()
                })
                .eq('id', transactionId)
                .eq('status', 'pending');

            if (error) throw error;
        } catch (error) {
            console.error('Error completing transaction:', error);
            throw error;
        }
    }

    async failTransaction(transactionId, reason) {
        try {
            const { error } = await supabase
                .from('transactions')
                .update({
                    status: 'failed',
                    error_message: reason,
                    updated_at: new Date().toISOString()
                })
                .eq('id', transactionId)
                .eq('status', 'pending');

            if (error) throw error;
        } catch (error) {
            console.error('Error failing transaction:', error);
            throw error;
        }
    }

    async getTransactionsBySession(sessionId) {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting session transactions:', error);
            throw error;
        }
    }

    async getTransactionById(transactionId) {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('id', transactionId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting transaction:', error);
            throw error;
        }
    }
}

export default TransactionService;