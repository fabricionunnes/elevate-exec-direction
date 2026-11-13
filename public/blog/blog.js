(function(){
  "use strict";
  var uh=document.getElementById("uh");
  function topo(){ if(uh) uh.classList.toggle("rolou", window.scrollY>8); }
  topo(); window.addEventListener("scroll",topo,{passive:true});

  var art=document.querySelector(".bx .art"); if(!art) return;
  var barra=document.getElementById("barra");
  var secs=[].slice.call(art.querySelectorAll(".sec h2"));
  var nav=null, links=[];
  if(secs.length>=3){
    nav=document.createElement("nav"); nav.className="sumario"; nav.setAttribute("aria-label","Neste conteúdo");
    var h='<p>Neste conteúdo</p>';
    secs.forEach(function(s,i){ var sec=s.closest(".sec"); if(!sec.id) sec.id="s"+(i+1); h+='<a href="#'+sec.id+'">'+s.textContent+'</a>'; });
    nav.innerHTML=h; document.body.appendChild(nav); links=[].slice.call(nav.querySelectorAll("a"));
  }
  var fim=document.querySelector(".autor")||document.querySelector(".cmt");
  function rola(){
    var y=window.scrollY, ini=art.offsetTop, alt=(fim?fim.offsetTop:art.offsetTop+art.offsetHeight)-ini-window.innerHeight*0.5;
    if(barra) barra.style.width=Math.max(0,Math.min(100,(y-ini)/Math.max(1,alt)*100))+"%";
    if(!nav) return;
    var primeira=secs[0].closest(".sec").getBoundingClientRect().top, ultimo=fim?fim.getBoundingClientRect().top:1e9;
    nav.classList.toggle("on", primeira<window.innerHeight*0.55 && ultimo>220);
    var at=0; secs.forEach(function(s,i){ if(s.getBoundingClientRect().top<180) at=i; });
    links.forEach(function(a,i){ a.classList.toggle("at", i===at); });
  }
  rola(); window.addEventListener("scroll",rola,{passive:true}); window.addEventListener("resize",rola);
})();
