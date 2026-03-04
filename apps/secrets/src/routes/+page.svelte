<script lang="ts">
  import { connect, initAndUnlock } from '$lib/vault-client';
  import {
    loadSecrets, loadVariables, putSecret, deleteSecret,
    putVariable, deleteVariable, getSecrets, getVariables,
    isLoading, getError, clearError
  } from '$lib/secrets-store.svelte';
  import type { AuthState } from '$lib/types';

  type Tab = 'secrets' | 'variables';

  let auth = $state<AuthState>({ status: 'disconnected' });
  let activeTab = $state<Tab>('secrets');

  // Add form
  let showAddForm = $state(false);
  let addName = $state('');
  let addValue = $state('');
  let adding = $state(false);

  // Edit state
  let editingName = $state<string | null>(null);
  let editValue = $state('');
  let saving = $state(false);

  // Delete state
  let deletingName = $state<string | null>(null);

  let secrets = $derived(getSecrets());
  let variables = $derived(getVariables());
  let loading = $derived(isLoading());
  let storeError = $derived(getError());

  async function handleConnect() {
    auth = { status: 'connecting' };
    try {
      const result = await connect();
      auth = { status: 'connected', address: result.address, keyId: result.keyId };
      await handleUnlock(result.keyId);
    } catch (e: any) {
      auth = { status: 'error', error: e.message || 'Connection failed' };
    }
  }

  async function handleUnlock(keyId: string) {
    auth = { ...auth, status: 'unlocking' };
    try {
      await initAndUnlock(keyId);
      auth = { ...auth, status: 'ready' };
      await Promise.all([loadSecrets(), loadVariables()]);
    } catch (e: any) {
      auth = { status: 'error', error: e.message || 'Vault unlock failed' };
    }
  }

  function resetAddForm() {
    showAddForm = false;
    addName = '';
    addValue = '';
  }

  async function addItem() {
    if (!addName.trim() || !addValue.trim()) return;
    adding = true;
    clearError();
    try {
      if (activeTab === 'secrets') {
        await putSecret(addName.trim(), addValue.trim());
      } else {
        await putVariable(addName.trim(), addValue.trim());
      }
      resetAddForm();
    } finally {
      adding = false;
    }
  }

  function startEdit(name: string, currentValue?: string) {
    editingName = name;
    editValue = currentValue || '';
  }

  function cancelEdit() {
    editingName = null;
    editValue = '';
  }

  async function saveEdit() {
    if (!editingName || !editValue.trim()) return;
    saving = true;
    clearError();
    try {
      if (activeTab === 'secrets') {
        await putSecret(editingName, editValue.trim());
      } else {
        await putVariable(editingName, editValue.trim());
      }
      cancelEdit();
    } finally {
      saving = false;
    }
  }

  async function deleteItem(name: string) {
    deletingName = name;
    clearError();
    try {
      if (activeTab === 'secrets') {
        await deleteSecret(name);
      } else {
        await deleteVariable(name);
      }
    } finally {
      deletingName = null;
    }
  }

  function switchTab(tab: Tab) {
    activeTab = tab;
    resetAddForm();
    cancelEdit();
  }

  function formatDate(date: string): string {
    if (!date) return 'recently';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'recently';
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
</script>

<div class="mx-auto max-w-3xl px-4 py-8">
  <header class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900">Secrets & Variables</h1>
    <p class="mt-1 text-gray-500">Store and manage secrets and environment variables</p>
  </header>

  {#if storeError}
    <div class="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-600 text-sm">
      {storeError}
      <button onclick={() => clearError()} class="ml-2 text-red-400 hover:text-red-600">x</button>
    </div>
  {/if}

  <!-- Auth: disconnected -->
  {#if auth.status === 'disconnected'}
    <div class="rounded-xl border border-gray-200 bg-white p-0">
      <div class="py-16 text-center">
        <div class="mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">Connect to Get Started</h2>
        <p class="text-gray-500 mb-6 max-w-md mx-auto">
          Connect with OpenKey to unlock your encrypted vault and manage secrets and variables.
        </p>
        <button
          onclick={handleConnect}
          class="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          Connect with OpenKey
        </button>
      </div>
    </div>

  <!-- Auth: connecting -->
  {:else if auth.status === 'connecting'}
    <div class="rounded-xl border border-gray-200 bg-white p-0">
      <div class="py-16 text-center">
        <div class="mb-4">
          <svg class="mx-auto h-8 w-8 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <p class="text-gray-500">Connecting...</p>
      </div>
    </div>

  <!-- Auth: connected / unlocking -->
  {:else if auth.status === 'connected' || auth.status === 'unlocking'}
    <div class="rounded-xl border border-gray-200 bg-white p-0">
      <div class="py-16 text-center">
        <div class="mb-4">
          <svg class="mx-auto h-8 w-8 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <p class="text-gray-500">Unlocking vault...</p>
      </div>
    </div>

  <!-- Auth: error -->
  {:else if auth.status === 'error'}
    <div class="rounded-xl border border-gray-200 bg-white p-0">
      <div class="py-16 text-center">
        <div class="mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">Connection Failed</h2>
        <p class="text-gray-500 mb-6 max-w-md mx-auto">{auth.error}</p>
        <button
          onclick={handleConnect}
          class="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          Retry
        </button>
      </div>
    </div>

  <!-- Auth: ready — full UI -->
  {:else if auth.status === 'ready'}
    <!-- Tab bar -->
    <div class="mb-6 flex gap-1 rounded-xl border border-gray-200 bg-gray-100 p-1">
      <button
        onclick={() => switchTab('secrets')}
        class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors {activeTab === 'secrets' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
      >
        Secrets ({secrets.length})
      </button>
      <button
        onclick={() => switchTab('variables')}
        class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors {activeTab === 'variables' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
      >
        Variables ({variables.length})
      </button>
    </div>

    <!-- Info banner -->
    <div class="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
      {#if activeTab === 'secrets'}
        Secrets are encrypted at rest. Values are write-only and cannot be retrieved after creation.
      {:else}
        Variables are stored as plaintext and can be read back. Use secrets for sensitive values.
      {/if}
    </div>

    <!-- Content card -->
    <div class="rounded-xl border border-gray-200 bg-white p-6">
      <div class="mb-6 flex items-center justify-between">
        <h2 class="text-xl font-semibold text-gray-900">
          {activeTab === 'secrets' ? 'Secrets' : 'Variables'}
        </h2>
        {#if !showAddForm}
          <button
            onclick={() => showAddForm = true}
            class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            + Add {activeTab === 'secrets' ? 'Secret' : 'Variable'}
          </button>
        {/if}
      </div>

      <!-- Add form -->
      {#if showAddForm}
        <div class="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div class="flex flex-col gap-3">
            <div>
              <label for="add-name" class="mb-1 block text-sm text-gray-500">Name</label>
              <input
                id="add-name"
                bind:value={addName}
                placeholder="e.g. API_KEY"
                class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
              />
            </div>
            <div>
              <label for="add-value" class="mb-1 block text-sm text-gray-500">Value</label>
              <input
                id="add-value"
                bind:value={addValue}
                placeholder="Enter value"
                type={activeTab === 'secrets' ? 'password' : 'text'}
                class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
              />
            </div>
            <div class="flex items-center gap-2">
              <button
                onclick={addItem}
                disabled={adding || !addName.trim() || !addValue.trim()}
                class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? 'Adding...' : 'Add'}
              </button>
              <button
                onclick={resetAddForm}
                class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Items list -->
      {#if loading}
        <div class="py-12 text-center text-gray-400">
          <p>Loading...</p>
        </div>
      {:else if activeTab === 'secrets'}
        {#if secrets.length === 0}
          <div class="py-12 text-center text-gray-400">
            <p>No secrets yet. Add your first secret.</p>
          </div>
        {:else}
          <div class="flex flex-col gap-3">
            {#each secrets as secret}
              <div class="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4">
                {#if editingName === secret.name}
                  <div class="flex flex-1 items-center gap-2">
                    <span class="font-medium text-gray-900 shrink-0">{secret.name}</span>
                    <input
                      bind:value={editValue}
                      placeholder="New value"
                      type="password"
                      class="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                    />
                    <button
                      onclick={saveEdit}
                      disabled={saving || !editValue.trim()}
                      class="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onclick={cancelEdit}
                      class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                {:else}
                  <div>
                    <div class="font-semibold text-gray-900">{secret.name}</div>
                    <div class="text-sm text-gray-500">
                      Added {formatDate(secret.createdAt)}
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      onclick={() => startEdit(secret.name)}
                      class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
                    >
                      Edit
                    </button>
                    <button
                      onclick={() => deleteItem(secret.name)}
                      disabled={deletingName === secret.name}
                      class="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-500 transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingName === secret.name ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {:else}
        {#if variables.length === 0}
          <div class="py-12 text-center text-gray-400">
            <p>No variables yet. Add your first variable.</p>
          </div>
        {:else}
          <div class="flex flex-col gap-3">
            {#each variables as variable}
              <div class="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4">
                {#if editingName === variable.name}
                  <div class="flex flex-1 items-center gap-2">
                    <span class="font-medium text-gray-900 shrink-0">{variable.name}</span>
                    <input
                      bind:value={editValue}
                      placeholder="New value"
                      class="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                    />
                    <button
                      onclick={saveEdit}
                      disabled={saving || !editValue.trim()}
                      class="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onclick={cancelEdit}
                      class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                {:else}
                  <div>
                    <div class="font-semibold text-gray-900">{variable.name}</div>
                    <div class="mt-1 flex items-center gap-2">
                      <code class="rounded bg-gray-100 px-2 py-0.5 font-mono text-sm text-gray-600">{variable.value}</code>
                    </div>
                    <div class="mt-1 text-sm text-gray-500">
                      Added {formatDate(variable.createdAt)}
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      onclick={() => startEdit(variable.name, variable.value)}
                      class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
                    >
                      Edit
                    </button>
                    <button
                      onclick={() => deleteItem(variable.name)}
                      disabled={deletingName === variable.name}
                      class="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-500 transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingName === variable.name ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>
