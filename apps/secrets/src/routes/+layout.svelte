<script>
  import '../app.css';
  let { children } = $props();
</script>

<div class="min-h-screen bg-gray-50">
  <header class="border-b border-gray-200 bg-white">
    <div class="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
      <h1 class="text-lg font-semibold text-gray-900">TinyCloud Secrets</h1>
    </div>
  </header>
  <main>
    {@render children()}
  </main>
</div>
