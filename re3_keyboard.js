(() => {
  const typedText = document.getElementById('typedText');
  const typedTextPI = document.getElementById('typedTextPI');
  const normalLines = [...document.querySelectorAll('.screen .line.normal')];
  const errorLines = [...document.querySelectorAll('.screen .line.error')];
  const promptLine = document.getElementById('promptLine');
  const keys = [...document.querySelectorAll('.key')];

  let text = "";
  let activeSeqToken = 0;
  let isTypingSequence = false;

  const templates = new Map();
  [...normalLines, ...errorLines, promptLine].forEach(el => {
    templates.set(el, el.cloneNode(true));
  });

  function render(){
    typedText.textContent = text;
  }

  function flash(key){
    key.classList.add("selected");
    setTimeout(() => key.classList.remove("selected"), 90);
  }

  const sleep = ms => new Promise(res => setTimeout(res, ms));

  function typeElement(el, charDelay = 25, seqToken) {
    return new Promise((resolve) => {
      const template = templates.get(el);
      if (template) el.innerHTML = template.innerHTML;

      const textNodes = [];
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while(node = walk.nextNode()){
        textNodes.push({ node, fullText: node.nodeValue });
        node.nodeValue = "";
      }

      el.style.display = "";

      let nodeIdx = 0;
      let charIdx = 0;

      function step() {
        if (seqToken !== activeSeqToken) {
          resolve(false);
          return;
        }
        if (nodeIdx >= textNodes.length) {
          resolve(true);
          return;
        }
        const item = textNodes[nodeIdx];
        item.node.nodeValue += item.fullText[charIdx];
        charIdx++;
        if (charIdx >= item.fullText.length) {
          nodeIdx++;
          charIdx = 0;
        }
        setTimeout(step, charDelay);
      }
      step();
    });
  }

  function clearKeyboardFocus(){
    const prevEl = currentEl();
    if(prevEl) prevEl.classList.remove("focus");
  }

  function restoreKeyboardFocus(){
    setFocus(0, 1);
  }

  async function playSequence(lines, charDelay = 25, lineDelay = 500) {
    const token = ++activeSeqToken;
    isTypingSequence = true;
    clearKeyboardFocus();

    normalLines.forEach(l => l.style.display = "none");
    errorLines.forEach(l => l.style.display = "none");
    promptLine.style.display = "none";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ok = await typeElement(line, charDelay, token);
      if (!ok || token !== activeSeqToken) return;

      if (i < lines.length - 1) {
        if (token !== activeSeqToken) return;
      }
    }

    if (token === activeSeqToken) {
      promptLine.style.display = "";
      render();
      isTypingSequence = false;
      restoreKeyboardFocus();
    }
  }

  function press(value, element){
    if(isTypingSequence) return;
    if(element) flash(element);

    if(value === "ESC"){
      text = "";
      render();
      playSequence(normalLines, 25, 500);
      return;
    }

    if(value === "BS"){
      text = text.slice(0,-1);
      render();
      return;
    }

    if(value === "ENTER"){
      if(text.length){
        typedTextPI.textContent = text;
        const currentText = text;
        text = "";
        render();
        
        const firstErrorLine = errorLines[0];
        const piSpan = firstErrorLine.querySelector('#typedTextPI');
        if (piSpan) piSpan.textContent = currentText;
        templates.set(firstErrorLine, firstErrorLine.cloneNode(true));

        playSequence(errorLines, 25, 500);
      }
      return;
    }

    if(/^[A-Z]$/.test(value) && text.length < 24){
      text += value;
      render();
    }
  }

  keys.forEach(k => k.addEventListener("click", () => press(k.dataset.key, k)));

  const grid = [
    ["ESC","A","B","C","D","E","F","G","H","BS"],
    ["I","J","K","L","M","N","O","P","Q","ENTER"],
    ["R","S","T","U","V","W","X","Y","Z","ENTER"]
  ];
  const keyByValue = new Map(keys.map(k => [k.dataset.key, k]));

  let cursorRow = 0, cursorCol = 1;

  function currentEl(){
    return keyByValue.get(grid[cursorRow][cursorCol]);
  }

  function setFocus(newRow, newCol){
    const prevEl = currentEl();
    if(prevEl) prevEl.classList.remove("focus");
    cursorRow = newRow;
    cursorCol = newCol;
    const nextEl = currentEl();
    if(nextEl) nextEl.classList.add("focus");
  }

  function moveCursor(dr, dc){
    let r = cursorRow, c = cursorCol;
    let nr = r + dr;
    let nc = c + dc;
    if(nr < 0) nr = grid.length - 1;
    if(nr > grid.length - 1) nr = 0;
    if(nc < 0) nc = grid[nr].length - 1;
    if(nc > grid[nr].length - 1) nc = 0;
    setFocus(nr, nc);
  }

  // DAS Engine
  const DAS_DELAY = 230;
  const DAS_RATE = 50;
  const ACTION_DELAY = 33;

  let activeArrowKey = null;
  let dasTimeout = null;
  let dasInterval = null;

  function stopDAS(){
    if(dasTimeout) clearTimeout(dasTimeout);
    if(dasInterval) clearInterval(dasInterval);
    dasTimeout = null;
    dasInterval = null;
    activeArrowKey = null;
  }

  function handleArrowPress(key, dr, dc){
    if(isTypingSequence || activeArrowKey === key) return;
    stopDAS();
    activeArrowKey = key;

    moveCursor(dr, dc);

    dasTimeout = setTimeout(() => {
      dasInterval = setInterval(() => {
        moveCursor(dr, dc);
      }, DAS_RATE);
    }, DAS_DELAY);
  }

  function triggerAction(actionFn){
    setTimeout(actionFn, ACTION_DELAY);
  }

  window.addEventListener("keydown", e => {
    if(isTypingSequence || e.repeat) return;

    switch(e.key){
      case "ArrowUp":
        e.preventDefault();
        handleArrowPress("ArrowUp", -1, 0);
        break;
      case "ArrowDown":
        e.preventDefault();
        handleArrowPress("ArrowDown", 1, 0);
        break;
      case "ArrowLeft":
        e.preventDefault();
        handleArrowPress("ArrowLeft", 0, -1);
        break;
      case "ArrowRight":
        e.preventDefault();
        handleArrowPress("ArrowRight", 0, 1);
        break;
      case "c":
      case "C":
        e.preventDefault();
        triggerAction(() => press(grid[cursorRow][cursorCol], currentEl()));
        break;
      case "Escape":
        e.preventDefault();
        triggerAction(() => press("ESC", keyByValue.get("ESC")));
        break;
      case "Backspace":
        e.preventDefault();
        triggerAction(() => press("BS", keyByValue.get("BS")));
        break;
      case "Enter":
        e.preventDefault();
        triggerAction(() => press("ENTER", keyByValue.get("ENTER")));
        break;
    }
  });

  window.addEventListener("keyup", e => {
    if(e.key === activeArrowKey){
      stopDAS();
    }
  });

  window.addEventListener("blur", stopDAS);

  playSequence(normalLines, 25, 500);
})();