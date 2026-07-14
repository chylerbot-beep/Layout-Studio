(() => {
  const moduleVersion = '20260714-auto-ruler-v40';
  const parts = [
    'app-parts/01.js', 'app-parts/02.js', 'app-parts/03.js', 'app-parts/04.js',
    'app-parts/05.js', 'app-parts/06.js', 'app-parts/07.js', 'app-parts/09.js',
    'app-parts/10.js', 'app-parts/11.js', 'app-parts/12.js', 'app-parts/14.js',
    'app-parts/15.js', 'app-parts/16.js', 'app-parts/17.js', 'app-parts/18.js',
    'app-parts/19.js', 'app-parts/20.js', 'app-parts/21.js', 'app-parts/22.js',
    'app-parts/23.js', 'app-parts/24.js', 'app-parts/25.js', 'app-parts/26.js',
    'app-parts/27.js',
    // app-parts/08.js starts the app after every override above has loaded.
    'app-parts/08.js'
  ];
  Promise.all(parts.map(path => fetch(`${path}?v=${moduleVersion}`, {cache:'no-store'}).then(response => {
    if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
    return response.text();
  })))
    .then(sourceParts => {
      const script = document.createElement('script');
      script.textContent = sourceParts.join('\n');
      document.body.appendChild(script);
    })
    .catch(error => {
      console.error(error);
      const viewport = document.getElementById('viewport');
      if (viewport) viewport.innerHTML = `<div style="padding:24px;color:#fff">Could not load Layout Studio: ${error.message}</div>`;
    });
})();
