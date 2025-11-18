(() => {
  const Xn = 95.047, Yn = 100.000, Zn = 108.883;
  const initialColor = "#4ea6ff";

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const round = (x, p = 3) => Math.round(x * Math.pow(10, p)) / Math.pow(10, p);

  let lock = false;
  let inputMode = 'sliders';

  function F_forward(x) {
    return (x >= 0.04045) ? Math.pow((x + 0.055) / 1.055, 2.4) : x / 12.92;
  }

  function F_reverse(x) {
    return (x >= 0.0031308) ? 1.055 * Math.pow(x, 1/2.4) - 0.055 : 12.92 * x;
  }

  function rgb255_to_xyz(rgb){
    const Rn = F_forward(rgb.r / 255) * 100;
    const Gn = F_forward(rgb.g / 255) * 100;
    const Bn = F_forward(rgb.b / 255) * 100;

    const X = 0.412453 * Rn + 0.357580 * Gn + 0.180423 * Bn;
    const Y = 0.212671 * Rn + 0.715160 * Gn + 0.072169 * Bn;
    const Z = 0.019334 * Rn + 0.119193 * Gn + 0.950227 * Bn;
    
    return {X, Y, Z};
  }

  function xyz_to_rgb255(xyz){
    const X = xyz.X / 100;
    const Y = xyz.Y / 100;
    const Z = xyz.Z / 100;

    const Rn = 3.2406 * X + (-1.5372) * Y + (-0.4986) * Z;
    const Gn = (-0.9689) * X + 1.8758 * Y + 0.0415 * Z;
    const Bn = 0.0557 * X + (-0.2040) * Y + 1.0570 * Z;

    let clipped = false;
    const [rLinear, gLinear, bLinear] = [Rn, Gn, Bn].map(v => {
      if (v < 0 || v > 1) clipped = true;
      return clamp(v, 0, 1);
    });

    const r = Math.round(F_reverse(rLinear) * 255);
    const g = Math.round(F_reverse(gLinear) * 255);
    const b = Math.round(F_reverse(bLinear) * 255);
    
    return {
      r: clamp(r, 0, 255),
      g: clamp(g, 0, 255),
      b: clamp(b, 0, 255),
      clipped
    };
  }

  function fLab(t){
    return (t > 0.008856451679) ? Math.cbrt(t) : (7.787037037 * t + 16/116);
  }
  function finvLab(t){
    const t3 = t * t * t;
    return (t3 > 0.008856451679) ? t3 : (t - 16/116) / 7.787037037;
  }

  function xyz_to_lab(X, Y, Z){
    const fx = fLab(X/Xn);
    const fy = fLab(Y/Yn);
    const fz = fLab(Z/Zn);
    const L = 116 * fy - 16;
    const a = 500 * (fx - fy);
    const b = 200 * (fy - fz);
    return {L, a, b};
  }

  function lab_to_xyz(L, a, b){
    const fy = (L + 16) / 116;
    const fx = fy + a / 500;
    const fz = fy - b / 200;
    const X = Xn * finvLab(fx);
    const Y = Yn * finvLab(fy);
    const Z = Zn * finvLab(fz);
    return {X, Y, Z};
  }

  function rgb_to_hsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    const d = max - min;
    
    if (max === min) {
      h = s = 0;
    } else {
      s = d / (1 - Math.abs(2 * l - 1));
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return {
      H: h * 360,
      S: s * 100,
      L: l * 100
    };
  }

  function hsl_to_rgb(h, s, l) {
    h = h % 360;
    if (h < 0) h += 360;
    s = s / 100;
    l = l / 100;
    
    if (s === 0) {
      const value = Math.round(l * 255);
      return {r: value, g: value, b: value};
    }
    
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hNormalized = h / 360;
    
    const r = hue2rgb(p, q, hNormalized + 1/3);
    const g = hue2rgb(p, q, hNormalized);
    const b = hue2rgb(p, q, hNormalized - 1/3);
    
    return {
      r: Math.round(clamp(r, 0, 1) * 255),
      g: Math.round(clamp(g, 0, 1) * 255),
      b: Math.round(clamp(b, 0, 1) * 255)
    };
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
  const hslFields = document.getElementById('hlsFields');

  let XYZ = {X: 23, Y: 52.6, Z: 18.22};
  let LAB = xyz_to_lab(XYZ.X, XYZ.Y, XYZ.Z);
  let HSL = rgb_to_hsl(...Object.values(xyz_to_rgb255(XYZ)).slice(0,3));

  const xyzUI = {};
  xyzUI.X = makeField(xyzFields,'X','X',0,100,0.001,(v)=>{XYZ.X=v; updateFrom('XYZ');});
  xyzUI.Y = makeField(xyzFields,'Y','Y',0,100,0.001,(v)=>{XYZ.Y=v; updateFrom('XYZ');});
  xyzUI.Z = makeField(xyzFields,'Z','Z',0,100,0.001,(v)=>{XYZ.Z=v; updateFrom('XYZ');});

  const labUI = {};
  labUI.L = makeField(labFields,'L','L',0,100,0.001,(v)=>{LAB.L=v; updateFrom('LAB');});
  labUI.a = makeField(labFields,'a','a',-128,127,0.001,(v)=>{LAB.a=v; updateFrom('LAB');});
  labUI.b = makeField(labFields,'b','b',-128,127,0.001,(v)=>{LAB.b=v; updateFrom('LAB');});

  const hslUI = {};
  hslUI.H = makeField(hslFields,'H','H°',0,360,0.1,(v)=>{HSL.H=v; updateFrom('HSL');});
  hslUI.S = makeField(hslFields,'S','S %',0,100,0.1,(v)=>{HSL.S=v; updateFrom('HSL');});
  hslUI.L = makeField(hslFields,'L','L %',0,100,0.1,(v)=>{HSL.L=v; updateFrom('HSL');});

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
    HSL = rgb_to_hsl(rgb.r, rgb.g, rgb.b);
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
    HSL = rgb_to_hsl(rgb.r, rgb.g, rgb.b);
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
      HSL = rgb_to_hsl(rgb.r, rgb.g, rgb.b);
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
      HSL = rgb_to_hsl(rgb.r, rgb.g, rgb.b);
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

    hslUI.H.set(round(HSL.H, 3));
    hslUI.S.set(round(HSL.S, 3));
    hslUI.L.set(round(HSL.L, 3));

    const hex = rgb_to_hex(rgb);
    preview.style.background = hex;
    colorHex.value = hex;
    hexInput.value = hex.toUpperCase();
    rgbInput.value = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
    lock = false;
  }

  function updateFrom(source){
    if (lock) return; 
    lock = true;
    
    let rgb, clip = false;
    
    if (source === 'XYZ'){
      LAB = xyz_to_lab(XYZ.X, XYZ.Y, XYZ.Z);
      const rr = xyz_to_rgb255(XYZ); 
      clip = rr.clipped; 
      rgb = rr;
      HSL = rgb_to_hsl(rr.r, rr.g, rr.b);
    } else if (source === 'LAB'){
      XYZ = lab_to_xyz(LAB.L, LAB.a, LAB.b);
      const rr = xyz_to_rgb255(XYZ); 
      clip = rr.clipped; 
      rgb = rr;
      HSL = rgb_to_hsl(rr.r, rr.g, rr.b);
    } else if (source === 'HSL'){
      rgb = hsl_to_rgb(HSL.H, HSL.S, HSL.L);
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
        const rgb = hsl_to_rgb(
          parseInt(color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)[1]),
          parseInt(color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)[2]),
          parseInt(color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)[3])
        );
        
        XYZ = rgb255_to_xyz(rgb);
        LAB = xyz_to_lab(XYZ.X, XYZ.Y, XYZ.Z);
        HSL = rgb_to_hsl(rgb.r, rgb.g, rgb.b);
        syncAll(rgb);
      });
      
      palette.appendChild(colorDiv);
    });
  }

  (function init(){
    const rgb = hex_to_rgb(initialColor);
    XYZ = rgb255_to_xyz(rgb);
    LAB = xyz_to_lab(XYZ.X, XYZ.Y, XYZ.Z);
    HSL = rgb_to_hsl(rgb.r, rgb.g, rgb.b);
    syncAll(rgb);
    
    generatePalette();
  })();
})();
