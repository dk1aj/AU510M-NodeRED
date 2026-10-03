<template>
  <Teleport to="body">
    <section v-if="activeTab === 'meter'" class="aurora-kiosk aurora-meter-static" data-active="true" aria-label="Simulated Power and SWR meter">
      <nav class="aurora-tabs" role="tablist" aria-label="Aurora meter pages">
        <button v-for="tab in tabs" :key="tab.key" type="button" role="tab" :aria-selected="activeTab === tab.key" @click="selectTab(tab.key)">{{ tab.label }}</button>
        <span class="aurora-brand">AU-510M <small>DISPLAY TEST</small></span>
      </nav>
      <div class="meter-test-stage">
        <div class="meter-test-presets" role="group" aria-label="Display-only meter presets">
          <button v-for="preset in testPresets" :key="preset.key" type="button" :aria-pressed="testPreset === preset.key" @click="selectTestPreset(preset.key)">{{ preset.key }}</button>
        </div>
      <svg id="aurora-panel-meter" class="power-swr-static-svg" viewBox="0 0 640 390" role="img" aria-label="Simulated analog forward power, reflected power and SWR">
        <defs>
          <linearGradient id="static-meter-amber" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b6a4e"/><stop offset="0.52" stop-color="#c79962"/><stop offset="1" stop-color="#f1c17a"/></linearGradient>
          <radialGradient id="static-meter-glow" cx="50%" cy="94%" r="80%"><stop offset="0" stop-color="#ffe4a5" stop-opacity=".8"/><stop offset=".6" stop-color="#ffc886" stop-opacity=".18"/><stop offset="1" stop-color="#322318" stop-opacity=".25"/></radialGradient>
          <clipPath id="static-meter-face-clip"><rect x="13" y="14" width="614" height="330" rx="8"/></clipPath>
          <path id="forward-label-arc" d="M46.23 268.8 A410 410 0 0 1 145.31 65.66" fill="none"/>
          <path id="reflected-label-arc" d="M494.69 65.66 A410 410 0 0 1 593.77 268.8" fill="none"/>
        </defs>
        <rect x="1" y="1" width="638" height="388" rx="13" fill="#151a20" stroke="#59606a" stroke-width="2"/>
        <rect x="13" y="14" width="614" height="330" rx="8" fill="url(#static-meter-amber)" stroke="#28221b" stroke-width="3"/>
        <rect x="13" y="14" width="614" height="330" rx="8" fill="url(#static-meter-glow)"/>
        <g clip-path="url(#static-meter-face-clip)" fill="none" stroke="#7b5036" stroke-width="1">
          <path d="M406.43 332.32 L406.65 330.22 L406.88 328.5 L407.1 326.99 L407.32 325.63 L407.55 324.39 L407.78 323.23 L408.01 322.14 L408.23 321.11 L408.46 320.13 L408.7 319.18 L408.93 318.28 L409.16 317.41 L409.4 316.56 L409.64 315.74 L409.87 314.94 L410.11 314.16 L410.35 313.4 L410.6 312.66 L410.84 311.94 L411.08 311.23 L411.33 310.53 L411.58 309.84 L411.83 309.17 L412.08 308.5 L412.33 307.85 L412.58 307.21 L412.83 306.57 L413.09 305.94 L413.35 305.33 L413.61 304.71 L413.87 304.11 L414.13 303.51 L414.39 302.92 L414.66 302.33 L414.92 301.75 L415.19 301.18 L415.46 300.61 L415.73 300.04 L416 299.48"/>
          <path d="M370.11 325.91 L370.39 322.05 L370.68 318.84 L370.97 316.03 L371.26 313.49 L371.55 311.15 L371.84 308.96 L372.14 306.89 L372.44 304.92 L372.74 303.03 L373.05 301.22 L373.36 299.47 L373.67 297.77 L373.99 296.11 L374.3 294.5 L374.62 292.93 L374.95 291.38 L375.27 289.87 L375.6 288.38 L375.93 286.92 L376.27 285.48 L376.61 284.06 L376.95 282.66 L377.29 281.27 L377.64 279.9 L377.99 278.55 L378.35 277.2 L378.7 275.87 L379.07 274.55 L379.43 273.24 L379.8 271.93 L380.17 270.64 L380.55 269.35 L380.93 268.07 L381.31 266.8 L381.7 265.53 L382.09 264.26 L382.48 263 L382.88 261.74 L383.28 260.49"/>
          <path d="M339.26 320.47 L339.44 315.06 L339.62 310.56 L339.81 306.58 L340 302.97 L340.19 299.62 L340.38 296.46 L340.58 293.47 L340.78 290.6 L340.98 287.84 L341.19 285.16 L341.4 282.56 L341.61 280.03 L341.82 277.54 L342.04 275.11 L342.26 272.72 L342.49 270.36 L342.71 268.03 L342.94 265.73 L343.18 263.45 L343.41 261.19 L343.65 258.95 L343.9 256.72 L344.15 254.5 L344.4 252.3 L344.65 250.1 L344.91 247.9 L345.18 245.71 L345.44 243.53 L345.72 241.34 L345.99 239.16 L346.27 236.97 L346.56 234.78 L346.85 232.58 L347.14 230.38 L347.44 228.17 L347.74 225.96 L348.05 223.73 L348.36 221.5 L348.68 219.26"/>
          <path d="M312.59 315.77 L312.5 310.29 L312.42 305.57 L312.33 301.33 L312.25 297.43 L312.16 293.78 L312.07 290.32 L311.98 287.02 L311.88 283.83 L311.79 280.75 L311.69 277.75 L311.59 274.82 L311.49 271.95 L311.39 269.13 L311.29 266.35 L311.18 263.61 L311.08 260.9 L310.97 258.21 L310.86 255.55 L310.75 252.9 L310.63 250.26 L310.51 247.63 L310.4 245.01 L310.27 242.4 L310.15 239.78 L310.03 237.17 L309.9 234.55 L309.77 231.92 L309.64 229.29 L309.5 226.65 L309.36 224 L309.22 221.34 L309.08 218.66 L308.94 215.97 L308.79 213.25 L308.64 210.52 L308.48 207.77 L308.32 205 L308.16 202.2 L308 199.37"/>
          <path d="M293.6 312.42 L293.38 308.88 L293.16 305.66 L292.95 302.66 L292.72 299.85 L292.5 297.17 L292.27 294.61 L292.04 292.15 L291.81 289.78 L291.57 287.47 L291.34 285.22 L291.1 283.02 L290.85 280.87 L290.6 278.76 L290.35 276.69 L290.1 274.64 L289.84 272.63 L289.58 270.64 L289.32 268.67 L289.06 266.72 L288.79 264.78 L288.51 262.86 L288.24 260.95 L287.96 259.06 L287.67 257.17 L287.39 255.3 L287.09 253.42 L286.8 251.56 L286.5 249.7 L286.2 247.84 L285.89 245.99 L285.58 244.13 L285.26 242.28 L284.94 240.43 L284.62 238.57 L284.29 236.71 L283.96 234.85 L283.62 232.99 L283.28 231.12 L282.93 229.25"/>
          <path d="M268.01 307.91 L267.76 306.22 L267.51 304.6 L267.26 303.03 L267 301.52 L266.74 300.04 L266.49 298.61 L266.22 297.21 L265.96 295.84 L265.7 294.5 L265.43 293.19 L265.16 291.89 L264.89 290.62 L264.62 289.37 L264.34 288.14 L264.07 286.92 L263.79 285.72 L263.51 284.53 L263.22 283.36 L262.94 282.2 L262.65 281.04 L262.36 279.9 L262.07 278.77 L261.77 277.65 L261.48 276.54 L261.18 275.43 L260.87 274.33 L260.57 273.24 L260.26 272.15 L259.95 271.07 L259.64 269.99 L259.33 268.92 L259.01 267.86 L258.69 266.8 L258.37 265.74 L258.04 264.68 L257.72 263.63 L257.39 262.58 L257.05 261.53 L256.72 260.49"/>
        </g>
        <g fill="#292a24" stroke="#292a24" font-family="Georgia,serif">
          <path d="M72 340 L72.06 333.4 L72.23 326.81 L72.52 320.22 L72.92 313.63 L73.44 307.06 L74.07 300.49 L74.82 293.93 L75.68 287.39 L76.65 280.87 L77.74 274.36 L78.94 267.87 L80.26 261.41 L81.69 254.97 L83.23 248.55 L84.88 242.17 L86.64 235.81 L88.52 229.48 L90.5 223.19 L92.59 216.94 L94.8 210.72 L97.11 204.54 L99.52 198.4 L102.05 192.3 L104.68 186.25 L107.42 180.25 L110.26 174.3 L113.2 168.39 L116.25 162.54 L119.39 156.74 L122.64 151 L125.99 145.32 L129.44 139.69 L132.98 134.13 L136.62 128.63 L140.36 123.19 L144.19 117.82 L148.12 112.51 L152.13 107.28 L156.24 102.12 L160.44 97.03 L164.72 92.01 L169.09 87.07 L173.55 82.2 L178.09 77.42 L182.71 72.71 L187.42 68.09 L192.2 63.55 L197.07 59.09 L202.01 54.72 L207.03 50.44" fill="none" stroke-width="2.3"/>
          <path d="M568 340 L567.94 333.4 L567.77 326.81 L567.48 320.22 L567.08 313.63 L566.56 307.06 L565.93 300.49 L565.18 293.93 L564.32 287.39 L563.35 280.87 L562.26 274.36 L561.06 267.87 L559.74 261.41 L558.31 254.97 L556.77 248.55 L555.12 242.17 L553.36 235.81 L551.48 229.48 L549.5 223.19 L547.41 216.94 L545.2 210.72 L542.89 204.54 L540.48 198.4 L537.95 192.3 L535.32 186.25 L532.58 180.25 L529.74 174.3 L526.8 168.39 L523.75 162.54 L520.61 156.74 L517.36 151 L514.01 145.32 L510.56 139.69 L507.02 134.13 L503.38 128.63 L499.64 123.19 L495.81 117.82 L491.88 112.51 L487.87 107.28 L483.76 102.12 L479.56 97.03 L475.28 92.01 L470.91 87.07 L466.45 82.2 L461.91 77.42 L457.29 72.71 L452.58 68.09 L447.8 63.55 L442.93 59.09 L437.99 54.72 L432.97 50.44" fill="none" stroke-width="2.3"/>
          <path d="M90 340 L90.05 333.72 L90.22 327.44 L90.49 321.16 L90.88 314.89 L91.37 308.62 L91.97 302.37 L92.68 296.13 L93.5 289.9 L94.43 283.68 L95.47 277.49 L96.61 271.31 L97.87 265.15 L99.23 259.02 L100.69 252.91 L102.27 246.83 L103.95 240.77 L105.73 234.75 L107.62 228.75 L109.61 222.8 L111.71 216.87 L113.91 210.99 L116.21 205.14 L118.62 199.34 L121.12 193.57 L123.73 187.86 L126.43 182.19 L129.24 176.56 L132.14 170.99 L135.14 165.47 L138.23 160 L141.42 154.59 L144.7 149.23 L148.08 143.93 L151.55 138.69 L155.11 133.51 L158.75 128.4 L162.49 123.35 L166.32 118.36 L170.23 113.44 L174.22 108.6 L178.3 103.82 L182.47 99.11 L186.71 94.48 L191.04 89.92 L195.44 85.44 L199.92 81.04 L204.48 76.71 L209.11 72.47 L213.82 68.3 L218.6 64.22" fill="none" stroke-width=".8"/>
          <path d="M550 340 L549.95 333.72 L549.78 327.44 L549.51 321.16 L549.12 314.89 L548.63 308.62 L548.03 302.37 L547.32 296.13 L546.5 289.9 L545.57 283.68 L544.53 277.49 L543.39 271.31 L542.13 265.15 L540.77 259.02 L539.31 252.91 L537.73 246.83 L536.05 240.77 L534.27 234.75 L532.38 228.75 L530.39 222.8 L528.29 216.87 L526.09 210.99 L523.79 205.14 L521.38 199.34 L518.88 193.57 L516.27 187.86 L513.57 182.19 L510.76 176.56 L507.86 170.99 L504.86 165.47 L501.77 160 L498.58 154.59 L495.3 149.23 L491.92 143.93 L488.45 138.69 L484.89 133.51 L481.25 128.4 L477.51 123.35 L473.68 118.36 L469.77 113.44 L465.78 108.6 L461.7 103.82 L457.53 99.11 L453.29 94.48 L448.96 89.92 L444.56 85.44 L440.08 81.04 L435.52 76.71 L430.89 72.47 L426.18 68.3 L421.4 64.22" fill="none" stroke-width=".8"/>
          <line x1="72" y1="340" x2="79" y2="340" stroke-width="0.65"/>
          <line x1="77.74" y1="274.36" x2="84.64" y2="275.58" stroke-width="0.65"/>
          <line x1="83.46" y1="247.64" x2="90.24" y2="249.35" stroke-width="0.65"/>
          <line x1="89.14" y1="227.46" x2="95.82" y2="229.55" stroke-width="0.65"/>
          <line x1="94.8" y1="210.72" x2="101.37" y2="213.11" stroke-width="0.65"/>
          <line x1="100.42" y1="196.2" x2="106.9" y2="198.86" stroke-width="0.65"/>
          <line x1="106.02" y1="183.28" x2="112.39" y2="186.18" stroke-width="0.65"/>
          <line x1="111.59" y1="171.59" x2="117.86" y2="174.71" stroke-width="0.65"/>
          <line x1="117.13" y1="160.89" x2="123.29" y2="164.2" stroke-width="0.65"/>
          <line x1="122.64" y1="151" x2="128.7" y2="154.5" stroke-width="0.65"/>
          <line x1="128.13" y1="141.81" x2="134.09" y2="145.48" stroke-width="0.65"/>
          <line x1="133.58" y1="133.21" x2="139.44" y2="137.04" stroke-width="0.65"/>
          <line x1="139.01" y1="125.13" x2="144.77" y2="129.11" stroke-width="0.65"/>
          <line x1="144.41" y1="117.52" x2="150.07" y2="121.64" stroke-width="0.65"/>
          <line x1="149.78" y1="110.33" x2="155.34" y2="114.58" stroke-width="0.65"/>
          <line x1="155.12" y1="103.5" x2="160.58" y2="107.88" stroke-width="0.65"/>
          <line x1="160.44" y1="97.03" x2="165.8" y2="101.53" stroke-width="0.65"/>
          <line x1="165.72" y1="90.86" x2="170.99" y2="95.47" stroke-width="0.65"/>
          <line x1="170.98" y1="84.99" x2="176.15" y2="89.71" stroke-width="0.65"/>
          <line x1="176.21" y1="79.38" x2="181.28" y2="84.2" stroke-width="0.65"/>
          <line x1="181.42" y1="74.02" x2="186.39" y2="78.94" stroke-width="0.65"/>
          <line x1="186.59" y1="68.89" x2="191.47" y2="73.91" stroke-width="0.65"/>
          <line x1="191.74" y1="63.98" x2="196.53" y2="69.09" stroke-width="0.65"/>
          <line x1="196.86" y1="59.28" x2="201.55" y2="64.47" stroke-width="0.65"/>
          <line x1="201.96" y1="54.76" x2="206.55" y2="60.05" stroke-width="0.65"/>
          <line x1="207.03" y1="50.44" x2="211.53" y2="55.8" stroke-width="0.65"/>
          <line x1="568" y1="340" x2="561" y2="340" stroke-width="0.65"/>
          <line x1="560.83" y1="266.71" x2="553.96" y2="268.06" stroke-width="0.65"/>
          <line x1="553.7" y1="237.01" x2="546.96" y2="238.91" stroke-width="0.65"/>
          <line x1="546.61" y1="214.66" x2="540.01" y2="216.98" stroke-width="0.65"/>
          <line x1="539.58" y1="196.2" x2="533.1" y2="198.86" stroke-width="0.65"/>
          <line x1="532.58" y1="180.25" x2="526.24" y2="183.21" stroke-width="0.65"/>
          <line x1="525.64" y1="166.13" x2="519.42" y2="169.35" stroke-width="0.65"/>
          <line x1="518.73" y1="153.4" x2="512.65" y2="156.86" stroke-width="0.65"/>
          <line x1="511.87" y1="141.81" x2="505.91" y2="145.48" stroke-width="0.65"/>
          <line x1="505.06" y1="131.14" x2="499.22" y2="135.01" stroke-width="0.65"/>
          <line x1="498.29" y1="121.27" x2="492.58" y2="125.32" stroke-width="0.65"/>
          <line x1="491.56" y1="112.09" x2="485.98" y2="116.31" stroke-width="0.65"/>
          <line x1="484.88" y1="103.5" x2="479.42" y2="107.88" stroke-width="0.65"/>
          <line x1="478.24" y1="95.46" x2="472.9" y2="99.99" stroke-width="0.65"/>
          <line x1="471.64" y1="87.89" x2="466.43" y2="92.56" stroke-width="0.65"/>
          <line x1="465.09" y1="80.75" x2="460" y2="85.56" stroke-width="0.65"/>
          <line x1="458.58" y1="74.02" x2="453.61" y2="78.94" stroke-width="0.65"/>
          <line x1="452.12" y1="67.64" x2="447.26" y2="72.69" stroke-width="0.65"/>
          <line x1="445.69" y1="61.6" x2="440.96" y2="66.76" stroke-width="0.65"/>
          <line x1="439.31" y1="55.87" x2="434.7" y2="61.14" stroke-width="0.65"/>
          <line x1="432.97" y1="50.44" x2="428.47" y2="55.8" stroke-width="0.65"/>
          <line x1="72" y1="340" x2="88" y2="340" stroke-width="1.8"/><text x="108" y="334" text-anchor="middle" stroke="none" font-size="13">0</text>
          <line x1="100.42" y1="196.2" x2="115.22" y2="202.28" stroke-width="1.8"/><text x="133.72" y="213.89" text-anchor="middle" stroke="none" font-size="13">100</text>
          <line x1="128.13" y1="141.81" x2="141.75" y2="150.19" stroke-width="1.8"/><text x="158.78" y="164.68" text-anchor="middle" stroke="none" font-size="13">200</text>
          <line x1="155.12" y1="103.5" x2="167.6" y2="113.52" stroke-width="1.8"/><text x="183.2" y="130.03" text-anchor="middle" stroke="none" font-size="13">300</text>
          <line x1="181.42" y1="74.02" x2="192.79" y2="85.28" stroke-width="1.8"/><text x="207" y="103.35" text-anchor="middle" stroke="none" font-size="13">400</text>
          <line x1="207.03" y1="50.44" x2="217.31" y2="62.69" stroke-width="1.8"/><text x="230.17" y="82.01" text-anchor="middle" stroke="none" font-size="13">500</text>
          <line x1="568" y1="340" x2="552" y2="340" stroke-width="1.8"/><text x="532" y="334" text-anchor="middle" stroke="none" font-size="13">0</text>
          <line x1="539.58" y1="196.2" x2="524.78" y2="202.28" stroke-width="1.8"/><text x="506.28" y="213.89" text-anchor="middle" stroke="none" font-size="13">20</text>
          <line x1="511.87" y1="141.81" x2="498.25" y2="150.19" stroke-width="1.8"/><text x="481.22" y="164.68" text-anchor="middle" stroke="none" font-size="13">40</text>
          <line x1="484.88" y1="103.5" x2="472.4" y2="113.52" stroke-width="1.8"/><text x="456.8" y="130.03" text-anchor="middle" stroke="none" font-size="13">60</text>
          <line x1="458.58" y1="74.02" x2="447.21" y2="85.28" stroke-width="1.8"/><text x="433" y="103.35" text-anchor="middle" stroke="none" font-size="13">80</text>
          <line x1="432.97" y1="50.44" x2="422.69" y2="62.69" stroke-width="1.8"/><text x="409.83" y="82.01" text-anchor="middle" stroke="none" font-size="13">100</text>
          <text text-anchor="middle" stroke="none" font-size="19" letter-spacing="1"><textPath href="#forward-label-arc" startOffset="50%">FORWARD</textPath></text>
          <text text-anchor="middle" stroke="none" font-size="19" letter-spacing="1"><textPath href="#reflected-label-arc" startOffset="50%">REFLECTED</textPath></text>
          <text x="153" y="71" stroke="none" font-size="14" font-weight="bold">W</text>
          <text x="477" y="71" stroke="none" font-size="14" font-weight="bold">W</text>
          <text x="411.58" y="301.84" text-anchor="middle" stroke="none" font-size="13" font-weight="bold">1.2</text>
          <text x="377.29" y="273.27" text-anchor="middle" stroke="none" font-size="13" font-weight="bold">1.5</text>
          <text x="344.4" y="244.3" text-anchor="middle" stroke="none" font-size="13" font-weight="bold">2</text>
          <text x="310.03" y="229.17" text-anchor="middle" stroke="none" font-size="13" font-weight="bold">3</text>
          <text x="287.09" y="245.42" text-anchor="middle" stroke="none" font-size="13" font-weight="bold">5</text>
          <text x="260.57" y="265.24" text-anchor="middle" stroke="none" font-size="16" font-weight="bold">∞</text>
        </g>
        <g aria-hidden="true">
          <g class="meter-test-needle meter-test-forward" :style="{ transform: `rotate(${forwardWattsToAngle(testForward)}deg)` }">
          <line x1="450" y1="340" x2="72" y2="340" stroke="#f3d8a5" stroke-width="5" opacity=".45"/>
          <line x1="450" y1="340" x2="72" y2="340" stroke="#171a19" stroke-width="2.7"/>
          </g>
          <g class="meter-test-needle meter-test-reflected" :style="{ transform: `rotate(${reflectedWattsToAngle(testReflected)}deg)` }">
          <line x1="190" y1="340" x2="568" y2="340" stroke="#f3d8a5" stroke-width="5" opacity=".45"/>
          <line x1="190" y1="340" x2="568" y2="340" stroke="#171a19" stroke-width="2.7"/>
          </g>
          <circle cx="450" cy="340" r="5" fill="#24221e" stroke="#95704a"/>
          <circle cx="190" cy="340" r="5" fill="#24221e" stroke="#95704a"/>
        </g>
        <rect x="19" y="350" width="602" height="30" fill="#1b2633" stroke="#5b6571"/>
        <text x="320" y="374" fill="#f2f4f5" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="bold" text-anchor="middle" letter-spacing="3">SWR</text>
      </svg>
        <aside class="meter-test-readout" aria-label="Synthetic meter values" aria-live="polite">
          <strong>TEST</strong>
          <span>FWD: <b>{{ testForward }} W</b></span>
          <span>REF: <b>{{ testReflected.toFixed(1) }} W</b></span>
          <span>SWR: <b>{{ testSwr.toFixed(2) }}</b></span>
        </aside>
      </div>
      <footer class="meter-static-footer"><span>TEST · NO LIVE DATA</span><span>Old: v{{ oldVersion }} | New: v{{ newVersion }}</span></footer>
    </section>
  </Teleport>
</template>
<script>
export default {
  data() { return {
    activeTab: 'radio', tabListener: null, oldVersion: '…', newVersion: '…',
    testPreset: 'ZERO', testForward: 0, testReflected: 0, testSwr: 1,
    testPresets: [
      { key: 'ZERO', forward: 0, reflected: 0, swr: 1 },
      { key: 'LOW', forward: 50, reflected: 1, swr: 1.33 },
      { key: 'MEDIUM', forward: 150, reflected: 5, swr: 1.45 },
      { key: 'HIGH', forward: 300, reflected: 20, swr: 1.70 },
      { key: 'FULL', forward: 500, reflected: 100, swr: 2.62 }
    ],
    tabs: [{ key: 'radio', label: 'RADIO' }, { key: 'pa', label: 'PA' }, { key: 'tx', label: 'TX' },
      { key: 'rx', label: 'RX' }, { key: 'external', label: 'EXT' }, { key: 'agct', label: 'AGC-T' }, { key: 'meter', label: 'METER' }]
  }; },
  methods: {
    forwardWattsToAngle(watts) {
      // Existing 0–500 W ticks follow a 50-degree square-root scale.
      const value = Number(watts);
      return 50 * Math.sqrt(Math.min(500, Math.max(0, Number.isFinite(value) ? value : 0)) / 500);
    },
    reflectedWattsToAngle(watts) {
      // Opposite sweep on the existing 0–100 W scale, with the same geometry.
      const value = Number(watts);
      return -50 * Math.sqrt(Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0)) / 100);
    },
    selectTestPreset(key) {
      const preset = this.testPresets.find(item => item.key === key);
      if (!preset) return;
      this.testPreset = preset.key;
      this.testForward = preset.forward;
      this.testReflected = preset.reflected;
      this.testSwr = preset.swr;
    },
    selectTab(key) {
      if (!this.tabs.some(tab => tab.key === key)) return;
      this.activeTab = key;
      try { sessionStorage.setItem('aurora-800x480-tab', key); } catch (_) {}
      window.dispatchEvent(new CustomEvent('aurora-800x480-tab', { detail: key }));
    }
  },
  mounted() {
    this.tabListener = event => { if (this.tabs.some(tab => tab.key === event.detail)) this.activeTab = event.detail; };
    window.addEventListener('aurora-800x480-tab', this.tabListener);
    try { const saved = sessionStorage.getItem('aurora-800x480-tab'); if (this.tabs.some(tab => tab.key === saved)) this.activeTab = saved; } catch (_) {}
    fetch('/agct-watcher/status', { cache: 'no-store' }).then(response => response.ok ? response.json() : null).then(status => {
      if (status) { this.oldVersion = status.oldVersion || '…'; this.newVersion = status.uiVersion || '…'; }
    }).catch(() => {});
  },
  beforeUnmount() { window.removeEventListener('aurora-800x480-tab', this.tabListener); }
}
</script>
<style>
.aurora-kiosk.aurora-meter-static{position:fixed;left:0;top:0;width:800px;height:480px;z-index:2500;display:grid;grid-template-rows:42px minmax(0,1fr) 24px;gap:5px;padding:8px;background:#0e151e;color:#edf5fc;box-sizing:border-box;overflow:hidden}
.aurora-meter-static *{box-sizing:border-box}
.aurora-kiosk.aurora-meter-static .aurora-tabs{display:grid;grid-template-columns:repeat(7,minmax(0,1fr)) 154px;gap:6px;height:42px}
.aurora-meter-static .aurora-tabs button{min-width:0;padding:0;border:1px solid #405268;border-radius:5px;background:#1b2938;color:#cfdfec;font:700 18px/1 Arial,Helvetica,sans-serif;cursor:pointer;touch-action:manipulation}
.aurora-meter-static .aurora-tabs button[aria-selected="true"]{color:#06121b;background:#63d1fa;border-color:#63d1fa}
.aurora-meter-static .aurora-brand{display:flex;flex-direction:column;align-items:flex-end;justify-content:center;font:17px Arial,Helvetica,sans-serif;white-space:nowrap}
.aurora-meter-static .aurora-brand small{font-size:10px;color:#adc0d1;letter-spacing:1px;margin-top:3px}
.meter-test-stage{position:relative;min-height:0;display:grid;justify-items:center}
.meter-test-presets,.meter-test-readout{position:absolute;top:50%;transform:translateY(-50%);width:68px;font:11px/1.4 Arial,Helvetica,sans-serif}
.meter-test-presets{left:0;display:grid;gap:6px}
.meter-test-presets button{height:30px;padding:0;border:1px solid #405268;border-radius:4px;background:#1b2938;color:#cfdfec;font:700 10px Arial,Helvetica,sans-serif;cursor:pointer;touch-action:manipulation}
.meter-test-presets button[aria-pressed="true"]{border-color:#63d1fa;color:#8ddfff}
.meter-test-readout{right:0;display:grid;gap:12px;color:#adc0d1;text-align:center}
.meter-test-readout strong{font-size:12px;letter-spacing:1px}
.meter-test-readout span,.meter-test-readout b{display:block}
.meter-test-readout b{font-weight:400;color:#cfdfec}
.meter-test-needle{transform-box:view-box;transition:transform 250ms ease-in-out}
.meter-test-forward{transform-origin:450px 340px}
.meter-test-reflected{transform-origin:190px 340px}
.power-swr-static-svg{display:block;justify-self:center;width:auto;max-width:100%;height:100%;min-height:0;filter:drop-shadow(0 2px 5px #05080b)}
.meter-static-footer{display:flex;justify-content:space-between;align-items:center;padding:0 8px;border-top:1px solid #405268;color:#8ddfff;font:700 12px/20px Arial,Helvetica,sans-serif;white-space:nowrap}
</style>
