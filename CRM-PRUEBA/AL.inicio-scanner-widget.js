(function(){
    'use strict';
    function insert(){
        if((location.pathname.split('/').pop()||'AL.inicio.html').toLowerCase()!=='AL.inicio.html')return;
        if(document.getElementById('inicio-escaner-universal'))return;
        const main=document.querySelector('main');
        if(!main)return;
        const container=main.querySelector('.max-w-7xl,.max-w-6xl,.p-8,.p-6')||main;
        const card=document.createElement('a');
        card.id='inicio-escaner-universal';
        card.href='AL.escaner.html';
        card.className='block rounded-2xl border border-blue-500/25 bg-blue-950/10 p-5 hover:border-blue-400/50 transition mb-5';
        card.innerHTML='<div class="flex items-center justify-between gap-4"><div class="flex items-center gap-4"><div class="w-12 h-12 rounded-xl border border-blue-500/30 bg-blue-950/20 flex items-center justify-center text-2xl text-blue-300">⌗</div><div><p class="text-sm font-bold text-white">Escáner universal</p><p class="mt-1 text-xs text-gray-500">Consulta tickets, materiales, ubicaciones, proyectos y categorías.</p></div></div><span class="text-blue-300 text-xl">→</span></div>';
        const header=container.querySelector('header');
        if(header)header.insertAdjacentElement('afterend',card);
        else container.prepend(card);
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',insert,{once:true});else insert();
})();