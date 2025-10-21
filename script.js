(() => {
  const Xn = 95.047, Yn = 100.000, Zn = 108.883;
  const initialColor = "#4ea6ff";

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const round = (x, p=2) => Number.parseFloat(x).toFixed(p);

  let lock = false;
  let inputMode = 'sliders';

  function srgbToLinear(u) {
    return (u <= 0.04045) ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
  }
  function linearToSrgb(u) {
    return (u <= 0.0031308) ? 12.92 * u : 1.055 * Math.pow(u, 1/2.4) - 0.055;
  }

  function rgb255_to_xyz(rgb){
    const r = srgbToLinear(rgb.r/255);
    const g = srgbToLinear(rgb.g/255);
    const b = srgbToLinear(rgb.b/255);
    const X = (0.4124564*r + 0.3575761*g + 0.1804375*b) * 100;
    const Y = (0.2126729*r + 0.7151522*g + 0.0721750*b) * 100;
    const Z = (0.0193339*r + 0.1191920*g + 0.9503041*b) * 100;
    return {X, Y, Z};
  }

  function xyz_to_rgb255(xyz){
    const X = xyz.X/100, Y = xyz.Y/100, Z = xyz.Z/100;
    let rl =  3.2404542*X + (-1.5371385)*Y + (-0.4985314)*Z;
    let gl = -0.9692660*X +  1.8760108*Y +  0.0415560*Z;
    let bl =  0.0556434*X + (-0.2040259)*Y +  1.0572252*Z;

    let clipped = false;
    [rl, gl, bl] = [rl, gl, bl].map(v=>{
      if (v < 0 || v > 1) clipped = true;
      return clamp(v, 0, 1);
    });

    const r = Math.round(clamp(linearToSrgb(rl),0,1) * 255);
    const g = Math.round(clamp(linearToSrgb(gl),0,1) * 255);
    const b = Math.round(clamp(linearToSrgb(bl),0,1) * 255);
    return {r,g,b, clipped};
  }

  function fLab(t){
    return (t > 0.008856) ? Math.cbrt(t) : (7.787*t + 16/116);
  }
  function finvLab(t){
    const t3 = t*t*t;
    return (t3 > 0.008856) ? t3 : (t - 16/116)/7.787;
  }

  function xyz_to_lab(X,Y,Z){
    const fx = fLab(X/Xn), fy = fLab(Y/Yn), fz = fLab(Z/Zn);
    const L = 116*fy - 16;
    const a = 500*(fx - fy);
    const b = 200*(fy - fz);
    return {L,a,b};
  }
  function lab_to_xyz(L,a,b){
    const fy = (L + 16)/116;
    const fx = fy + a/500;
    const fz = fy - b/200;
    const X = Xn * finvLab(fx);
    const Y = Yn * finvLab(fy);
    const Z = Zn * finvLab(fz);
    return {X,Y,Z};
  }

  function rgb_to_hls(r,g,b){
    r/=255; g/=255; b/=255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    const L = (max + min)/2;
    let H,S;
    if (max === min){ H = 0; S = 0; }
    else{
      const d = max - min;
      S = (L > 0.5) ? d / (2 - max - min) : d / (max + min);
      switch(max){
        case r: H = (g - b) / d + (g < b ? 6 : 0); break;
        case g: H = (b - r) / d + 2; break;
        case b: H = (r - g) / d + 4; break;
      }
      H /= 6;
    }
    return {H: H*360, L: L*100, S: S*100};
  }
  function hue2rgb(p,q,t){
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q-p)*6*t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q-p)*(2/3 - t)*6;
    return p;
  }
  function hls_to_rgb(H,L,S){
    H = ((H%360)+360)%360; L/=100; S/=100;
    let r,g,b;
    if (S === 0){ r=g=b=L; }
    else{
      const q = L < 0.5 ? L*(1+S) : L + S - L*S;
      const p = 2*L - q;
      const h = H/360;
      r = hue2rgb(p,q,h + 1/3);
      g = hue2rgb(p,q,h);
      b = hue2rgb(p,q,h - 1/3);
    }
    return {r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255)};
  }

  function makeField(container, key, labelText, min, max, step, onInput){
    const row = document.createElement('div');
    row.className = 'group';

    const label = document.createElement('label');
    label.textContent = labelText;
    label.setAttribute('for', key+"-range");

    const range = document.createElement('input');
    range.type = 'range'; range.min=min; range.max=max; range.step=step; range.id = key+'-range';

    const num = document.createElement('input');
    num.type='number'; num.min=min; num.max=max; num.step=step; num.id = key+'-num';

    row.appendChild(label); row.appendChild(range); row.appendChild(num);
    container.appendChild(row);

    const syncVis = () => {
      const showRange = inputMode==='sliders';
      range.style.display = showRange? 'block':'none';
      num.style.display = showRange? 'none':'block';
    }
    syncVis();
    modeListeners.push(syncVis);

    const handler = (e)=>{
      if (lock) return;
      const v = parseFloat((e.target===range? range.value : num.value));
      range.value = v; num.value = v;
      onInput(v);
    };
    range.addEventListener('input', handler);
    num.addEventListener('input', handler);

    return {
      set(v){ range.value = v; num.value = v; },
      get(){ return parseFloat(range.value); }
    }
  }

  const modeListeners = [];
  function setInputMode(mode){ inputMode = mode; modeListeners.forEach(fn=>fn()); }

  const xyzFields = document.getElementById('xyzFields');
  const labFields = document.getElementById('labFields');
  const hlsFields = document.getElementById('hlsFields');

  let XYZ = {X: 24.79, Y: 25.37, Z: 87.35};
  let LAB = xyz_to_lab(XYZ.X, XYZ.Y, XYZ.Z);
  let HLS = rgb_to_hls(...Object.values(xyz_to_rgb255(XYZ)).slice(0,3));

  const xyzUI = {};
  xyzUI.X = makeField(xyzFields,'X','X',0,100,0.01,(v)=>{XYZ.X=v; updateFrom('XYZ');});
  xyzUI.Y = makeField(xyzFields,'Y','Y',0,100,0.01,(v)=>{XYZ.Y=v; updateFrom('XYZ');});
  xyzUI.Z = makeField(xyzFields,'Z','Z',0,100,0.01,(v)=>{XYZ.Z=v; updateFrom('XYZ');});

  const labUI = {};
  labUI.L = makeField(labFields,'L','L',0,100,0.01,(v)=>{LAB.L=v; updateFrom('LAB');});
  labUI.a = makeField(labFields,'a','a',-128,127,0.01,(v)=>{LAB.a=v; updateFrom('LAB');});
  labUI.b = makeField(labFields,'b','b',-128,127,0.01,(v)=>{LAB.b=v; updateFrom('LAB');});

  const hlsUI = {};
  hlsUI.H = makeField(hlsFields,'H','H°',0,360,0.1,(v)=>{HLS.H=v; updateFrom('HLS');});
  hlsUI.L = makeField(hlsFields,'HL','L %',0,100,0.1,(v)=>{HLS.L=v; updateFrom('HLS');});
  hlsUI.S = makeField(hlsFields,'HS','S %',0,100,0.1,(v)=>{HLS.S=v; updateFrom('HLS');});

  const colorHex = document.getElementById('colorHex');
  const hexInput = document.getElementById('hexInput');
  const rgbInput = document.getElementById('rgbInput');
  const gamutWarn = document.getElementById('gamutWarn');
  const preview = document.getElementById('preview');
  const copyHexBtn = document.getElementById('copyHex');
  const resetBtn = document.getElementById('resetBtn');

  copyHexBtn.addEventListener('click', async ()=>{
    await navigator.clipboard.writeText(hexInput.value);
    copyHexBtn.textContent = 'Скопировано!';
    setTimeout(()=>copyHexBtn.textContent='Скопировать',1200);
  });

  resetBtn.addEventListener('click', ()=>{
    lock = true;
    setInputMode('sliders');
    const rgb = hex_to_rgb(initialColor);
    XYZ = rgb255_to_xyz(rgb);
    LAB = xyz_to_lab(XYZ.X, XYZ.Y, XYZ.Z);
    HLS = rgb_to_hls(rgb.r, rgb.g, rgb.b);
    syncAll(rgb);
    lock = false;
  });

  document.querySelectorAll('.modeBtn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      setInputMode(btn.dataset.mode);
    });
  });

  colorHex.addEventListener('input', ()=>{
    const rgb = hex_to_rgb(colorHex.value);
    XYZ = rgb255_to_xyz(rgb);
    LAB = xyz_to_lab(XYZ.X, XYZ.Y, XYZ.Z);
    HLS = rgb_to_hls(rgb.r, rgb.g, rgb.b);
    syncAll(rgb);
  });

  hexInput.addEventListener('blur', function() {
    let hexValue = this.value.trim();
    if (!hexValue.startsWith('#')) {
      hexValue = '#' + hexValue;
    }
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hexValue)) {
      const rgb = hex_to_rgb(hexValue);
      XYZ = rgb255_to_xyz(rgb);
      LAB = xyz_to_lab(XYZ.X, XYZ.Y, XYZ.Z);
      HLS = rgb_to_hls(rgb.r, rgb.g, rgb.b);
      syncAll(rgb);
    } else {
      this.value = rgb_to_hex({r: parseInt(rgbInput.value.split(',')[0].trim()), g: parseInt(rgbInput.value.split(',')[1].trim()), b: parseInt(rgbInput.value.split(',')[2].trim())});
    }
  });

  hexInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      this.blur();
    }
  });

  rgbInput.addEventListener('blur', function() {
    const rgbValue = this.value.trim();
    const rgbArray = rgbValue.split(',').map(val => parseInt(val.trim()));
    if (rgbArray.length === 3 && rgbArray.every(val => !isNaN(val) && val >= 0 && val <= 255)) {
      const rgb = {r: rgbArray[0], g: rgbArray[1], b: rgbArray[2]};
      XYZ = rgb255_to_xyz(rgb);
      LAB = xyz_to_lab(XYZ.X, XYZ.Y, XYZ.Z);
      HLS = rgb_to_hls(rgb.r, rgb.g, rgb.b);
      syncAll(rgb);
    } else {
      const currentRgb = hex_to_rgb(hexInput.value);
      this.value = `${currentRgb.r}, ${currentRgb.g}, ${currentRgb.b}`;
    }
  });

  rgbInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      this.blur();
    }
  });

  function componentToHex(c){ const s = c.toString(16).toUpperCase(); return s.length===1?'0'+s:s; }
  function rgb_to_hex({r,g,b}){ return '#'+componentToHex(r)+componentToHex(g)+componentToHex(b); }
  function hex_to_rgb(hex){ hex = hex.replace('#',''); return {r:parseInt(hex.slice(0,2),16), g:parseInt(hex.slice(2,4),16), b:parseInt(hex.slice(4,6),16)} }

  function syncAll(rgb){
    lock = true;
    xyzUI.X.set(round(XYZ.X, 3));
    xyzUI.Y.set(round(XYZ.Y, 3));
    xyzUI.Z.set(round(XYZ.Z, 3));

    labUI.L.set(round(LAB.L, 3));
    labUI.a.set(round(LAB.a, 3));
    labUI.b.set(round(LAB.b, 3));

    hlsUI.H.set(round(HLS.H, 2));
    hlsUI.L.set(round(HLS.L, 2));
    hlsUI.S.set(round(HLS.S, 2));

    const hex = rgb_to_hex(rgb);
    preview.style.background = hex;
    colorHex.value = hex;
    hexInput.value = hex.toUpperCase();
    rgbInput.value = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
    lock = false;
  }

  function updateFrom(source){
    if (lock) return; lock = true;
    let rgb, clip=false;
    if (source === 'XYZ'){
      LAB = xyz_to_lab(XYZ.X, XYZ.Y, XYZ.Z);
      const rr = xyz_to_rgb255(XYZ); clip = rr.clipped; rgb = rr;
      HLS = rgb_to_hls(rr.r, rr.g, rr.b);
    } else if (source === 'LAB'){
      XYZ = lab_to_xyz(LAB.L, LAB.a, LAB.b);
      const rr = xyz_to_rgb255(XYZ); clip = rr.clipped; rgb = rr;
      HLS = rgb_to_hls(rr.r, rr.g, rr.b);
    } else if (source === 'HLS'){
      rgb = hls_to_rgb(HLS.H, HLS.L, HLS.S);
      XYZ = rgb255_to_xyz(rgb);
      LAB = xyz_to_lab(XYZ.X, XYZ.Y, XYZ.Z);
    }

    gamutWarn.style.display = clip ? 'block' : 'none';
    lock = false;
    syncAll(rgb);
  }

  function generatePalette() {
    const palette = document.getElementById('colorPalette');
    palette.innerHTML = '';
    
    const colors = [];
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 20; col++) {
        const hue = (col / 20) * 360;
        const saturation = 80 + (row % 3) * 10;
        const lightness = 30 + Math.floor(row / 2) * 15;
        
        colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
      }
    }

    colors.forEach((color, index) => {
      const colorDiv = document.createElement('div');
      colorDiv.style.backgroundColor = color;
      
      colorDiv.addEventListener('click', function() {
        const rgb = hls_to_rgb(
          parseInt(color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)[1]),
          parseInt(color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)[3]),
          parseInt(color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)[2])
        );
        
        XYZ = rgb255_to_xyz(rgb);
        LAB = xyz_to_lab(XYZ.X, XYZ.Y, XYZ.Z);
        HLS = rgb_to_hls(rgb.r, rgb.g, rgb.b);
        syncAll(rgb);
      });
      
      palette.appendChild(colorDiv);
    });
  }

  (function init(){
    const rgb = hex_to_rgb(initialColor);
    XYZ = rgb255_to_xyz(rgb);
    LAB = xyz_to_lab(XYZ.X, XYZ.Y, XYZ.Z);
    HLS = rgb_to_hls(rgb.r, rgb.g, rgb.b);
    syncAll(rgb);
    
    generatePalette();
  })();
})();