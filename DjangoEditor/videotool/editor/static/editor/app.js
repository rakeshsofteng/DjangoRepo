(() => {
  const $ = sel => document.querySelector(sel);
  const video = $("#video");
  const canvas = $("#timeline");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const infoEl = $("#info");
  const metaEl = $("#meta");

  // Tools
  const toolButtons = document.querySelectorAll(".toolbar .tool");
  let tool = "clip"; // "select" | "clip"

  // State
  let fps = 30;
  let totalFrames = 0;
  let deletes = []; // [ [s,e), ... ]
  let markIn = null, markOut = null;

  // Selection (for Clip tool)
  let dragging = false;
  let dragStartF = null, dragEndF = null;

  // Waveform per-frame (0..1)
  let wave = null;

  function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }
  function timeToFrame(t){ return Math.round(t * fps); }
  function frameToTime(f){ return f / fps; }
  function xToFrame(x){ return Math.round((x / W) * Math.max(0, totalFrames - 1)); }
  function frameToX(f){ return Math.round((f / Math.max(1,totalFrames - 1)) * (W - 1)); }

  function mergeRanges(ranges){
    ranges = ranges.filter(r=>r[1]>r[0]).sort((a,b)=>a[0]-b[0]);
    if (!ranges.length) return [];
    const out = [ranges[0].slice()];
    for (let i=1;i<ranges.length;i++){
      const [s,e] = ranges[i], last = out[out.length-1];
      if (s <= last[1]) last[1] = Math.max(last[1], e);
      else out.push([s,e]);
    }
    return out;
  }

  function addDelete(a,b){
    let s = Math.max(0, Math.min(a,b));
    let e = Math.min(totalFrames, Math.max(a,b)+1); // end exclusive
    if (e <= s) return;
    deletes.push([s,e]);
    deletes = mergeRanges(deletes);
    markIn = markOut = null;
    dragStartF = dragEndF = null;
    draw();
  }

  function invertDeletes(){
    const d = mergeRanges(deletes.map(r=>[clamp(r[0],0,totalFrames), clamp(r[1],0,totalFrames)]));
    const keeps = [];
    let prev = 0;
    for (const [s,e] of d){
      if (prev < s) keeps.push([prev, s]);
      prev = e;
    }
    if (prev < totalFrames) keeps.push([prev, totalFrames]);
    return keeps;
  }

  function draw(){
    // bg
    ctx.fillStyle = "#232323";
    ctx.fillRect(0,0,W,H);

    // waveform
    if (wave){
      const mid = H/2;
      ctx.strokeStyle = "rgb(0,180,0)";
      ctx.beginPath();
      for (let x=0;x<W;x++){
        const f = xToFrame(x);
        const amp = wave[f] || 0;
        const h = amp * (H*0.45);
        ctx.moveTo(x, mid-h);
        ctx.lineTo(x, mid+h);
      }
      ctx.stroke();
    }

    // deleted ranges
    ctx.fillStyle = "rgba(220,0,0,0.55)";
    for (const [s,e] of deletes){
      const x1 = frameToX(s), x2 = frameToX(Math.max(s+1,e));
      ctx.fillRect(x1, 0, x2-x1, H);
    }

    // selection (clip tool)
    if (tool === "clip" && dragging && dragStartF != null && dragEndF != null){
      const x1 = frameToX(dragStartF), x2 = frameToX(dragEndF);
      ctx.fillStyle = "rgba(255,165,0,0.45)";
      ctx.fillRect(Math.min(x1,x2), 0, Math.abs(x2-x1), H);
    }

    // in/out markers
    if (markIn != null){
      const xi = frameToX(markIn);
      ctx.strokeStyle = "cyan"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(xi,0); ctx.lineTo(xi,H); ctx.stroke();
    }
    if (markOut != null){
      const xo = frameToX(markOut);
      ctx.strokeStyle = "yellow"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(xo,0); ctx.lineTo(xo,H); ctx.stroke();
    }

    // playhead
    const cf = timeToFrame(video.currentTime || 0);
    ctx.strokeStyle = "white"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(frameToX(cf),0); ctx.lineTo(frameToX(cf),H); ctx.stroke();

    // ticks + info
    ctx.fillStyle = "#fff"; ctx.font = "12px system-ui, sans-serif";
    const dur = video.duration || 0;
    const ticks = Math.max(5, Math.floor(dur/10)+1);
    for (let i=0;i<=ticks;i++){
      const t = (i/ticks) * dur;
      const f = timeToFrame(t);
      const x = frameToX(f);
      ctx.fillRect(x, 0, 1, 8);
      const mm = Math.floor(t/60), ss = Math.floor(t%60).toString().padStart(2,"0");
      ctx.fillText(`${mm}:${ss}`, Math.max(0,x-12), 20);
    }

    infoEl.textContent = `Frames: ${totalFrames} | FPS: ${fps.toFixed(2)} | Cuts: ${deletes.length} | Tool: ${tool}`;
  }

  // Tool selection
  toolButtons.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      toolButtons.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      tool = btn.dataset.tool;
      canvas.style.cursor = (tool === "select") ? "default" : "crosshair";
      draw();
    });
  });

  // Right-click (context menu) → delete current selection (Clip tool)
  canvas.addEventListener("contextmenu", e=>{
    e.preventDefault();
    if (tool !== "clip") return;
    if (dragStartF != null && dragEndF != null && dragStartF !== dragEndF){
      addDelete(dragStartF, dragEndF);
    }
  });

  // Mouse interactions
  canvas.addEventListener("mousedown", e=>{
    if (tool === "clip"){
      dragging = true;
      dragStartF = dragEndF = xToFrame(e.offsetX);
      draw();
    } else if (tool === "select"){
      // seek
      const f = xToFrame(e.offsetX);
      video.currentTime = clamp(frameToTime(f), 0, video.duration || 0);
    }
  });
  canvas.addEventListener("mousemove", e=>{
    if (tool === "clip" && dragging){
      dragEndF = xToFrame(e.offsetX);
      draw();
    }
  });
  canvas.addEventListener("mouseup", e=>{
    if (tool === "clip"){
      dragEndF = xToFrame(e.offsetX);
      draw();
    }
  });
  // Simple click in select mode to seek
  canvas.addEventListener("click", e=>{
    if (tool === "select"){
      const f = xToFrame(e.offsetX);
      video.currentTime = clamp(frameToTime(f), 0, video.duration || 0);
    }
  });

  // Buttons
  const id = s=>document.getElementById(s);
  id("btnMarkIn").onclick  = ()=> { markIn = timeToFrame(video.currentTime||0); draw(); };
  id("btnMarkOut").onclick = ()=> { markOut = timeToFrame(video.currentTime||0); draw(); };
  id("btnDelete").onclick  = ()=> {
    if (markIn!=null && markOut!=null){ addDelete(markIn, markOut); }
    else if (dragStartF!=null && dragEndF!=null && dragStartF!==dragEndF){ addDelete(dragStartF, dragEndF); }
    else { const cf = timeToFrame(video.currentTime||0); addDelete(cf, cf); }
  };
  id("btnUndo").onclick = ()=> { deletes.pop(); draw(); };
  id("btnClear").onclick = ()=> { deletes = []; markIn=markOut=null; dragStartF=dragEndF=null; draw(); };
  id("btnSave").onclick = async ()=> {
    await fetch("/api/save",{method:"POST",headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ deletes: deletes, video_name: videoName })});
    alert("Project saved");
  };
  id("btnLoad").onclick = async ()=> {
    const res = await fetch("/api/load");
    const js = await res.json();
    if (js.ok){
      if (js.video_name && js.video_name !== videoName) alert("Loaded project is for a different video.");
      deletes = js.deletes || [];
      draw();
    }
  };
  id("btnExport").onclick = async ()=> {
    const res = await fetch("/api/export",{method:"POST",headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ deletes: deletes, video_name: videoName })});
    const js = await res.json();
    if (js.ok && js.download_url){
      const a = document.createElement("a"); a.href = js.download_url; a.download = ""; a.click();
    } else alert("Export failed");
  };

  // Keyboard shortcuts
  window.addEventListener("keydown", e=>{
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "v" || e.key === "V"){ document.querySelector('[data-tool="select"]').click(); }
    else if (e.key === "c" || e.key === "C"){ document.querySelector('[data-tool="clip"]').click(); }
    else if (e.key === "i" || e.key === "I"){ id("btnMarkIn").click(); }
    else if (e.key === "o" || e.key === "O"){ id("btnMarkOut").click(); }
    else if (e.key === "Delete" || e.key === "d" || e.key === "D"){ id("btnDelete").click(); }
    else if (e.key === "s" || e.key === "S"){ e.preventDefault(); id("btnSave").click(); }
    else if (e.key === "l" || e.key === "L"){ id("btnLoad").click(); }
    else if (e.key === "x" || e.key === "X"){ id("btnExport").click(); }
    else if (e.key === "ArrowLeft"){ video.currentTime = Math.max(0,(video.currentTime||0) - 1/fps); }
    else if (e.key === "ArrowRight"){ video.currentTime = Math.min(video.duration||0,(video.currentTime||0) + 1/fps); }
    else if (e.key === " "){ e.preventDefault(); if (video.paused) video.play(); else video.pause(); }
  });

  // Metadata & waveform
  async function loadMeta(){
    // ask server for true fps/frames
    const r = await fetch(`/api/meta?name=${encodeURIComponent(videoName)}`);
    if (!r.ok){ metaEl.textContent = "Meta unavailable"; return; }
    const js = await r.json();
    if (js.ok){
      totalFrames = js.total_frames;
      fps = js.fps || 30;
      metaEl.textContent = `Server FPS: ${fps.toFixed(3)} | Frames: ${totalFrames}`;
      draw();
      buildWaveform();
    }
  }

  async function buildWaveform(){
    try{
      const res = await fetch(video.src, {cache:"no-store"});
      const buf = await res.arrayBuffer();
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      const audio = await ac.decodeAudioData(buf.slice(0));
      const ch = audio.numberOfChannels ? audio.getChannelData(0) : null;
      if (!ch) return;
      const arr = new Float32Array(totalFrames);
      const spf = ch.length / Math.max(1,totalFrames);
      for (let f=0; f<totalFrames; f++){
        const a = Math.floor(f*spf), b = Math.min(ch.length, Math.floor((f+1)*spf));
        let sum=0, n=Math.max(1,b-a);
        for (let i=a;i<b;i++) sum += Math.abs(ch[i]);
        arr[f] = sum/n;
      }
      let maxv=0; for (let i=0;i<arr.length;i++) if (arr[i]>maxv) maxv=arr[i];
      if (maxv>0){ for (let i=0;i<arr.length;i++) arr[i]/=maxv; }
      wave = arr;
      draw();
    } catch(e){
      console.warn("Waveform unavailable:", e);
    }
  }

  video.addEventListener("loadedmetadata", loadMeta);
  video.addEventListener("timeupdate", draw);
})();
