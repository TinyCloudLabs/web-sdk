import type { Secret, Variable } from './types';
import { getTinyCloud } from './vault-client';

// Reactive state
let secrets = $state<Secret[]>([]);
let variables = $state<Variable[]>([]);
let loading = $state(false);
let error = $state('');

export function getSecrets() { return secrets; }
export function getVariables() { return variables; }
export function isLoading() { return loading; }
export function getError() { return error; }
export function clearError() { error = ''; }

// =========================================================================
// Secrets (vault-encrypted, prefix: secrets/)
// =========================================================================

export async function loadSecrets(): Promise<void> {
  const tc = getTinyCloud();
  if (!tc) return;

  loading = true;
  error = '';
  try {
    const result = await tc.vault.list({ prefix: 'secrets/' });
    if (!result.ok) {
      error = `Failed to list secrets: ${(result as any).error?.message}`;
      return;
    }

    const items: Secret[] = [];
    for (const key of result.data) {
      const name = key.replace(/^secrets\//, '');
      let createdAt = '';
      const getResult = await tc.vault.get<{ value: string; createdAt: string }>(key);
      if (getResult.ok && getResult.data?.value?.createdAt) {
        createdAt = getResult.data.value.createdAt;
      }
      items.push({ name, createdAt });
    }
    secrets = items;
  } catch (e: any) {
    error = e.message || 'Failed to load secrets';
  } finally {
    loading = false;
  }
}

export async function putSecret(name: string, value: string): Promise<boolean> {
  const tc = getTinyCloud();
  if (!tc) return false;

  error = '';
  try {
    const createdAt = new Date().toISOString();
    const result = await tc.vault.put(`secrets/${name}`, { value, createdAt });
    if (!result.ok) {
      error = `Failed to store secret: ${(result as any).error?.message}`;
      return false;
    }
    await loadSecrets();
    return true;
  } catch (e: any) {
    error = e.message || 'Failed to create secret';
    return false;
  }
}

export async function deleteSecret(name: string): Promise<boolean> {
  const tc = getTinyCloud();
  if (!tc) return false;

  error = '';
  try {
    const result = await tc.vault.delete(`secrets/${name}`);
    if (!result.ok) {
      error = `Failed to delete secret: ${(result as any).error?.message}`;
      return false;
    }
    await loadSecrets();
    return true;
  } catch (e: any) {
    error = e.message || 'Failed to delete secret';
    return false;
  }
}

// =========================================================================
// Variables (KV plaintext, prefix: variables/)
// =========================================================================

export async function loadVariables(): Promise<void> {
  const tc = getTinyCloud();
  if (!tc) return;

  loading = true;
  error = '';
  try {
    const kv = tc.kv.withPrefix('variables/');
    const result = await kv.list();
    if (!result.ok) {
      error = `Failed to list variables: ${(result as any).error?.message}`;
      return;
    }

    const items: Variable[] = [];
    for (const key of result.data.keys) {
      const getResult = await kv.get<{ value: string; createdAt: string }>(key);
      if (getResult.ok && getResult.data?.data) {
        const data = getResult.data.data as { value: string; createdAt: string };
        items.push({ name: key, value: data.value, createdAt: data.createdAt });
      }
    }
    variables = items;
  } catch (e: any) {
    error = e.message || 'Failed to load variables';
  } finally {
    loading = false;
  }
}

export async function putVariable(name: string, value: string): Promise<boolean> {
  const tc = getTinyCloud();
  if (!tc) return false;

  error = '';
  try {
    const kv = tc.kv.withPrefix('variables/');
    const createdAt = new Date().toISOString();
    const result = await kv.put(name, { value, createdAt });
    if (!result.ok) {
      error = `Failed to store variable: ${(result as any).error?.message}`;
      return false;
    }
    await loadVariables();
    return true;
  } catch (e: any) {
    error = e.message || 'Failed to create variable';
    return false;
  }
}

export async function deleteVariable(name: string): Promise<boolean> {
  const tc = getTinyCloud();
  if (!tc) return false;

  error = '';
  try {
    const kv = tc.kv.withPrefix('variables/');
    const result = await kv.delete(name);
    if (!result.ok) {
      error = `Failed to delete variable: ${(result as any).error?.message}`;
      return false;
    }
    await loadVariables();
    return true;
  } catch (e: any) {
    error = e.message || 'Failed to delete variable';
    return false;
  }
}
