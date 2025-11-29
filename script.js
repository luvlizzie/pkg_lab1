(() => {
  const Xn = 95.047, Yn = 100.000, Zn = 108.883;
  const initialColor = "#4ea6ff";

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const round = (x, p = 3) => Math.round(x * Math.pow(10, p)) / Math.pow(10, p);

  let lock = false;
  let inputMode = 'sliders';

  function xyz_to_rgb255(xyz){
    const var_X = xyz.X / 100;
    const var_Y = xyz.Y / 100;
    const var_Z = xyz.Z / 100;

    const var_R = var_X * 3.2406 + var_Y * -1.5372 + var_Z * -0.4986;
    const var_G = var_X * -0.9689 + var_Y * 1.8758 + var_Z * 0.0415;
    const var_B = var_X * 0.0557 + var_Y * -0.2040 + var_Z * 1.0570;

    const gammaCorrect = (v) => {
      if (v > 0.0031308) {
        return 1.055 * Math.pow(v, 1/2.4) - 0.055;
      } else {
        return 12.92 * v;
      }
    };

    let clipped = false;
    
    const rLinear = gammaCorrect(clamp(var_R, 0, 1));
    const gLinear = gammaCorrect(clamp(var_G, 0, 1));
    const bLinear = gammaCorrect(clamp(var_B, 0, 1));

    if (var_R < 0 || var_R > 1 || var_G < 0 || var_G > 1 || var_B < 0 || var_B > 1) {
      clipped = true;
    }

    const r = Math.round(rLinear * 255);
    const g = Math.round(gLinear * 255);
    const b = Math.round(bLinear * 255);
    
    return {
      r: clamp(r, 0, 255),
      g: clamp(g, 0, 255),
      b: clamp(b, 0, 255),
      clipped
    };
  }

  function rgb255_to_xyz(rgb){
    const linearize = (v) => {
      const normalized = v / 255;
      if (normalized > 0.04045) {
        return Math.pow((normalized + 0.055) / 1.055, 2.4);
      } else {
        return normalized / 12.92;
      }
    };

    const var_R = linearize(rgb.r);
    const var_G = linearize(rgb.g);
    const var_B = linearize(rgb.b);

    const var_R_100 = var_R * 100;
    const var_G_100 = var_G * 100;
    const var_B_100 = var_B * 100;

    const X = var_R_100 * 0.4124 + var_G_100 * 0.3576 + var_B_100 * 0.1805;
    const Y = var_R_100 * 0.2126 + var_G_100 * 0.7152 + var_B_100 * 0.0722;
    const Z = var_R_100 * 0.0193 + var_G_100 * 0.1192 + var_B_100 * 0.9505;
    
    return {X, Y, Z};
  }

  function xyz_to_lab(X, Y, Z){
    const var_X = X / Xn;
    const var_Y = Y / Yn;
    const var_Z = Z / Zn;

    const f = (t) => {
      if (t > 0.008856) {
        return Math.pow(t, 1/3);
      } else {
        return (7.787 * t) + (16 / 116);
      }
    };

    const fx = f(var_X);
    const fy = f(var_Y);
    const fz = f(var_Z);

    const L = 116 * fy - 16;
    const a = 500 * (fx - fy);
    const b = 200 * (fy - fz);
    
    return {L, a, b};
  }

  function lab_to_xyz(L, a, b){
    const var_Y = (L + 16) / 116;
    const var_X = a / 500 + var_Y;
    const var_Z = var_Y - b / 200;

    const f_inv = (t) => {
      const t3 = Math.pow(t, 3);
      if (t3 > 0.008856) {
        return t3;
      } else {
        return (t - 16/116) / 7.787;
      }
    };

    const X = Xn * f_inv(var_X);
    const Y = Yn * f_inv(var_Y);
    const Z = Zn * f_inv(var_Z);
    
    return {X, Y, Z};
  }

  function rgb_to_hsl(r, g, b) {
    const var_R = r / 255;
    const var_G = g / 255;
    const var_B = b / 255;

    const var_Min = Math.min(var_R, var_G, var_B);
    const var_Max = Math.max(var_R, var_G, var_B);
    const del_Max = var_Max - var_Min;

    const L = (var_Max + var_Min) / 2;

    let H = 0;
    let S = 0;

    if (del_Max === 0) {
      H = 0;
      S = 0;
    } else {
      if (L < 0.5) {
        S = del_Max / (var_Max + var_Min);
      } else {
        S = del_Max / (2 - var_Max - var_Min);
      }

      const del_R = (((var_Max - var_R) / 6) + (del_Max / 2)) / del_Max;
      const del_G = (((var_Max - var_G) / 6) + (del_Max / 2)) / del_Max;
      const del_B = (((var_Max - var_B) / 6) + (del_Max / 2)) / del_Max;

      if (var_R === var_Max) {
        H = del_B - del_G;
      } else if (var_G === var_Max) {
        H = (1 / 3) + del_R - del_B;
      } else if (var_B === var_Max) {
        H = (2 / 3) + del_G - del_R;
      }

      if (H < 0) H += 1;
      if (H > 1) H -= 1;
    }

    return {
      H: H * 360,
      S: S * 100,
      L: L * 100
    };
  }

  function hsl_to_rgb(h, s, l) {
    let H = h / 360;
    let S = s / 100;
    let L = l / 100;

    let r, g, b;

    if (S === 0) {
      r = g = b = L;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
      const p = 2 * L - q;

      r = hue2rgb(p, q, H + 1/3);
      g = hue2rgb(p, q, H);
      b = hue2rgb(p, q, H - 1/3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
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

  let XYZ = {X: 0, Y: 0, Z: 0};
  let LAB = {L: 0, a: 0, b: 0};
  let HSL = {H: 0, S: 0, L: 0};

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
