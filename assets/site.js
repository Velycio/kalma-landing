/* Kalma — animaciones compartidas (reveal, barra de progreso, pétalos) */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Reveal on scroll (con stagger dentro de cada grid) */
  document.querySelectorAll(".grid").forEach(function (g) {
    Array.prototype.forEach.call(g.querySelectorAll(".reveal"), function (el, i) {
      el.style.transitionDelay = (i % 3) * 80 + "ms";
    });
  });
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach(function (el) {
    io.observe(el);
  });

  /* Barra de progreso de scroll */
  var prog = document.getElementById("progress");
  function onScroll() {
    if (!prog) return;
    var d = document.documentElement;
    var max = d.scrollHeight - d.clientHeight;
    prog.style.width = (max > 0 ? (d.scrollTop / max) * 100 : 0) + "%";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Pétalos cayendo (decorativo, se desactiva con reduced-motion) */
  if (!reduce) {
    var layer = document.getElementById("petals");
    if (layer) {
      var N = window.innerWidth < 720 ? 8 : 14;
      for (var i = 0; i < N; i++) {
        var p = document.createElement("span");
        p.className = "petal";
        var size = 6 + ((i * 37) % 12);
        p.style.width = size + "px";
        p.style.height = size + "px";
        p.style.left = ((i * 53) % 100) + "vw";
        p.style.animationDuration = 10 + ((i * 7) % 12) + "s";
        p.style.animationDelay = -((i * 11) % 16) + "s";
        p.style.opacity = (0.2 + ((i * 13) % 30) / 100).toFixed(2);
        layer.appendChild(p);
      }
    }
  }
})();
