import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

export function getPasswordResetRedirect() {
  return Linking.createURL('reset-password');
}

function readAuthParams(url: string) {
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '';
  const hashParams = new URLSearchParams(hash);
  if (hashParams.get('access_token') || hashParams.get('code') || hashParams.get('error_description')) {
    return hashParams;
  }
  return new URLSearchParams(query);
}

export function isPasswordRecoveryUrl(url: string) {
  return url.includes('reset-password') || url.includes('type=recovery');
}

/** Turn a Supabase recovery redirect into a signed-in session. */
export async function createSessionFromUrl(url: string) {
  const params = readAuthParams(url);
  const errorDescription = params.get('error_description');
  if (errorDescription) {
    throw new Error(errorDescription.replace(/\+/g, ' '));
  }

  const code = params.get('code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return { session: data.session, type: params.get('type') };
  }

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;

  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return { session: data.session, type: params.get('type') };
}
