import { createClient } from '@supabase/supabase-js';

export const handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
            throw new Error('Supabase environment variables are not set.');
        }

        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        const { error } = await supabase
            .from('downloads')
            .delete()
            .neq('id', '0'); // delete all rows

        if (error) throw error;

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'History reset successfully' }),
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
