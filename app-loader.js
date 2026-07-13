(() => {
  const parts = ["app-parts/01.js", "app-parts/02.js", "app-parts/03.js", "app-parts/04.js", "app-parts/05.js", "app-parts/06.js", "app-parts/07.js", "app-parts/09.js", "app-parts/10.js", "app-parts/11.js", "app-parts/12.js", "app-parts/14.js", "app-parts/08.js"];
  Promise.all(parts.map(path => fetch(path).then(response => {
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
      if (viewport) viewport.innerHTML = `<div style="padding:24px;color:#fff">Could not load BTO Layout Studio: ${error.message}</div>`;
    });
})();
