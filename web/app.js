(() => {
  "use strict";

  const PRODUCT_NAME = "HCI AI Companion";
  const scenes = {
    keys: {
      title: "Find my keys",
      description: "Find the last place your keys were seen, then follow the light.",
      greeting: "I can help you find the last place you left something.",
      hint: "Enable the entryway, load a sample observation, then ask about your keys."
    },
    leaving: {
      title: "Leaving home",
      description: "See what the companion can suggest as you head out.",
      greeting: "I can use the sources you choose to help you get out the door.",
      hint: "Simulate opening the door. Suggestions depend on the permissions you choose."
    },
    privacy: {
      title: "Privacy & control",
      description: "Close the lens, then set a reminder with the camera off.",
      greeting: "You can set and review reminders with the camera off.",
      hint: "Use the physical shutter control, then try loading a new observation."
    },
    setup: {
      title: "First-time setup",
      description: "Choose what to call the companion and which help to enable.",
      greeting: "You can change your preferences any time in Settings.",
      hint: "Choose your permissions, or skip to start with the camera off."
    }
  };
  const sourceLabels = { calendar: "Calendar", weather: "Weather", items: "Item checklist" };
  Object.assign(scenes, {
    cooking:{title:"Cooking assistance",description:"Ask for the next recipe step or have Robin bring you a napkin.",greeting:"I’m here when you need a hand in the kitchen."},
    bedtime:{title:"Getting ready for bed",description:"Wind down with a wall switch, smart curtains, and a shutter you control.",greeting:"Your bedtime reminders are in Memory."},
    exam:{title:"Exam reminder",description:"Share a screenshot, make a plan, and let Robin adapt the reminder.",greeting:"What are we planning?"},
    free:{title:"Free exploration",description:"Try the app, then select a room label to invite Robin over. Privacy choices still apply.",greeting:"Hi! I’m here. Where shall we go?"}
  });
  const zoneLabels = { entry: "Entryway", study: "Workspace", living: "Living room", private: "Private zone" };
  const zoneLabelsZh = { entry: "玄关", study: "书桌区", living: "客厅", private: "私人区" };
  const keyRecord = { time: "8:10 am", zone: "Entryway", place: "left side of the entryway tray", source: "Hallway observation" };
  const commands = {
    keys: "Where are my keys?",
    leaving: "What should I take?",
    reminder: "Remind me to submit my assignment at 8 pm"
  };
  const emptyAnnouncement = "Demo reset. Camera off.";
  const insideDoor = [9.45, .96];
  const doorstep = [9.45, .20];
  const leavingActors = {
    away: {x:doorstep[0], y:doorstep[1], pose:'standing', path:[insideDoor, doorstep]},
    home: {x:insideDoor[0], y:insideDoor[1], pose:'standing', path:[doorstep, insideDoor]}
  };
  const defaultResident = {x:6.03,y:4.25,pose:'standing',zone:'living'};
  const homeSceneActors = {
    cooking: {x:8.03,y:6.19,pose:'cook'},
    bedtime: {x:4.98,y:3.36,pose:'phone'}
  };
  const homeSceneCommands = {
    'serve-napkin': {
      en:/^(?:(?:can|could|would) you )?(?:please )?(?:bring|give|hand|pass) me (?:a |the |one )?(?:napkin|tissue)(?: please)?$/,
      zh:/^(?:(?:递给我|拿给我|给我(?:拿|递)?)(?:一张|张)?(?:餐巾纸|纸巾|餐巾)|把(?:餐巾纸|纸巾|餐巾)(?:递给我|拿给我|给我)|(?:拿|递)(?:一张|张)?(?:餐巾纸|纸巾|餐巾)给我)$/
    },
    'press-light-switch': {
      lightsOn:false,
      en:/^(?:(?:can|could|would) you )?(?:please )?(?:(?:turn|switch) off (?:the |my )?(?:bedroom |bedside )?lights?|(?:turn|switch) (?:the |my )?(?:bedroom |bedside )?lights? off)(?: please)?$/,
      zh:/^(?:(?:关掉|关上|关闭|关一下|关下|关个|关)(?:卧室的?|床头的?)?灯|把(?:卧室的?|床头的?)?灯(?:关掉|关了|关上|关闭|关一下|关))$/
    },
    'turn-on-light': {
      lightsOn:true,
      en:/^(?:(?:can|could|would) you )?(?:please )?(?:(?:turn|switch) on (?:the |my )?(?:bedroom |bedside )?lights?|(?:turn|switch) (?:the |my )?(?:bedroom |bedside )?lights? on)(?: please)?$/,
      zh:/^(?:(?:打开|开启|点亮|开一下|开下|开)(?:卧室的?|床头的?)?灯|把(?:卧室的?|床头的?)?灯(?:打开|开启|点亮|开开|开了|开一下|开))$/
    },
    'close-curtains': {
      curtainsClosed:true,
      en:/^(?:(?:can|could|would) you )?(?:please )?(?:close|draw|shut) (?:the |my )?(?:bedroom )?curtains?(?: please)?$/,
      zh:/^(?:(?:拉上|关上|关闭|合上|关一下|关)(?:卧室的?)?窗帘|把(?:卧室的?)?窗帘(?:拉上|关上|关了|合上|关闭|关))$/
    },
    'open-curtains': {
      curtainsClosed:false,
      en:/^(?:(?:can|could|would) you )?(?:please )?(?:(?:open|pull open) (?:the |my )?(?:bedroom )?curtains?|(?:draw|pull) (?:the |my )?(?:bedroom )?curtains? open)(?: please)?$/,
      zh:/^(?:(?:拉开|打开|掀开|开一下|开)(?:卧室的?)?窗帘|把(?:卧室的?)?窗帘(?:拉开|打开|掀开|开开|开一下|开))$/
    }
  };

  const $ = selector => document.querySelector(selector);
  const { items, landmarks, areaStops, planResidentMove, currentResidentZone, residentAtDoor } = window.companionRoom;
  const roomTargets = {...items, ...landmarks};
  const aiMode = window.location && new URLSearchParams(window.location.search).get('ai') === '1';
  let state = initialState();
  let audio;
  let aiHistory = [];
  let aiRequest;
  let aiError = '';
  let voiceRequest = null;
  let voiceTimer;
  let voiceStatus = '';
  const memoryPrefix = 'mos.memory.v1:';
  let memoryProfile = '';
  let connectedCurtain = false;
  let curtainRequestPending = false;
  let memoryKey = '';
  let memoryAvailable = false;
  let lastStoredMemory = null;
  let lastSnapshot = '';
  let preferredPermissions = copyPermissions();

  function initialState() {
    return {
      scene: aiMode ? "free" : "keys",
      rail: "gantry",
      panel: aiMode ? "chat" : "setup",
      camera: false,
      zones: { entry: true, study: true, living: true, private: false },
      sources: { calendar: true, weather: true, items: true },
      demoWeather: 'rain',
      autonomy: "ask",
      alias: "Robin",
      sound: false,
      captions: true,
      records: { keys: null },
      spotlight: false,
      doorOpen: false,
      departure: null,
      reminders: [{ id: 1, title: "Wind down for bed · Every day", time: "22:30" }, { id: 2, title: "Wake up early · Every day", time: "07:00" }],
      rainReminder: null,
      nextReminderId: 4,
      choiceDone: false,
      flowIndex: -1,
      keySearchEnded: false,
      flowRoom: {},
      actionText: '',
      speaker: 'Robot says',
      speech: '',
      freeTarget: 'idle',
      freeActor: defaultResident,
      residentSelected: false,
      mosTarget: null,
      mosMode: null,
      mosHeld: null,
      mosGrip: null,
      mosQueue: [],
      mosReceived: [],
      zoneListOpen: false,
      examReference: false,
      pendingReminder: null,
      chatDraft: '',
      chatDraftModality: 'text',
      messages: { keys: [], leaving: [], privacy: [], setup: [], cooking: [], bedtime: [], exam: [], free: [] },
      caption: ""
    };
  }

  function copyPermissions() {
    return { zones:{...state.zones}, sources:{...state.sources}, autonomy:state.autonomy };
  }

  function restoreFlags(group, values) {
    for (const key of Object.keys(state[group])) {
      if (typeof values?.[key] === 'boolean') state[group][key] = values[key];
    }
  }

  function loadBrowserMemory(saved) {
    if (saved?.version !== 1) return;
    const { preferences, reminders, messages, history } = saved;
    if (typeof preferences?.alias === 'string') state.alias = preferences.alias.slice(0,24);
    if (typeof preferences?.sound === 'boolean') state.sound = preferences.sound;
    if (['gantry','track'].includes(preferences?.rail)) state.rail = preferences.rail;
    if (['ask','suggest'].includes(preferences?.autonomy)) state.autonomy = preferences.autonomy;
    if (['rain','dry'].includes(preferences?.demoWeather)) state.demoWeather = preferences.demoWeather;
    restoreFlags('zones', preferences?.zones);
    restoreFlags('sources', preferences?.sources);
    if (saved.observedKeys === true) state.records.keys = keyRecord;
    if (Array.isArray(reminders)) {
      state.reminders = reminders.slice(-100).flatMap(reminder => {
        if (!reminder || !Number.isSafeInteger(reminder.id) || reminder.id < 1 || reminder.id >= Number.MAX_SAFE_INTEGER ||
            typeof reminder.title !== 'string' || typeof reminder.time !== 'string' ||
            !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(reminder.time)) return [];
        const timed = typeof reminder.date === 'string' && /^\d{4}-\d\d-\d\d$/.test(reminder.date);
        return [{id:reminder.id, title:reminder.title.slice(0,240), time:reminder.time,
          ...(timed ? {date:reminder.date, zh:reminder.zh === true, fired:reminder.fired === true} : {})}];
      });
      state.nextReminderId = Math.max(3, ...state.reminders.map(reminder => reminder.id)) + 1;
    }
    const rain = saved.rainReminder;
    if (rain?.date && typeof rain.date === 'string' && /^\d{4}-\d\d-\d\d$/.test(rain.date)) {
      state.rainReminder = {date:rain.date, bring:rain.bring === true, zh:rain.zh === true,
        notified:rain.notified === true, delivered:rain.delivered === true};
    }
    for (const scene of Object.keys(state.messages)) {
      if (!Array.isArray(messages?.[scene])) continue;
      state.messages[scene] = messages[scene].slice(-24).flatMap(message =>
        ['user','assistant'].includes(message?.role) && typeof message.text === 'string' ?
          [{role:message.role, text:message.text.slice(0,5600), ai:true,
            modality:message.modality === 'voice' ? 'voice' : 'text'}] : []);
    }
    if (Array.isArray(history) && history.length <= 12 && history.length % 2 === 0 && history.every((message,index) =>
      message?.role === (index % 2 ? 'assistant' : 'user') && typeof message.content === 'string' &&
      message.content.trim() && message.content.length <= (index % 2 ? 5600 : 1200))) {
      aiHistory = history.map(({role,content}) => ({role,content}));
    }
  }

  function memorySnapshot() {
    if (!permissionsLocked()) preferredPermissions = copyPermissions();
    const messages = {};
    for (const [scene, transcript] of Object.entries(state.messages)) {
      const saved = transcript.filter(message => message.ai).slice(-24);
      if (saved.length) messages[scene] = saved.map(({role,text,modality}) =>
        modality === 'voice' ? {role,text,modality} : {role,text});
    }
    return JSON.stringify({
      version:1,
      preferences:{alias:state.alias, sound:state.sound, rail:state.rail, demoWeather:state.demoWeather, ...preferredPermissions},
      reminders:state.reminders.filter(reminder => !reminder.tag).slice(-100),
      rainReminder:state.rainReminder,
      observedKeys:Boolean(state.records.keys),
      messages,
      history:aiHistory
    });
  }

  function saveBrowserMemory() {
    const next = memorySnapshot();
    if (!memoryAvailable || next === lastSnapshot) return;
    try {
      if (window.localStorage.getItem(memoryKey) !== lastStoredMemory) {
        window.location.reload();
        return;
      }
      window.localStorage.setItem(memoryKey,next);
      lastStoredMemory = lastSnapshot = next;
    } catch {
      memoryAvailable = false;
    }
  }

  async function startBrowserMemory() {
    if (aiMode) {
      try {
        const result = await fetch('./ai/connect', {
          headers:{Accept:'application/json'}, credentials:'same-origin',
          cache:'no-store', redirect:'error', signal:AbortSignal.timeout(4500)
        });
        if (result.ok) {
          const { profile, curtain_connected } = await result.json();
          if (typeof profile === 'string' && /^[a-f0-9]{64}$/.test(profile)) memoryProfile = profile;
          connectedCurtain = curtain_connected === true;
        }
      } catch {
        // Chat remains available if the browser profile cannot be loaded.
      }
    }
    memoryKey = aiMode ? (memoryProfile ? memoryPrefix + memoryProfile : '') : memoryPrefix + 'guest';
    if (memoryKey) {
      try {
        lastStoredMemory = window.localStorage.getItem(memoryKey);
        memoryAvailable = true;
        if (lastStoredMemory) loadBrowserMemory(JSON.parse(lastStoredMemory));
      } catch {
        // Keep the defaults if local storage is blocked or contains invalid JSON.
      }
    }
    lastSnapshot = memorySnapshot();
  }

  function escape(value) {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(value).replace(/[&<>"']/g, character => entities[character]);
  }

  function button(action, label, { style = "phone-button", value = "", disabled = false } = {}) {
    const key = (style.startsWith("stage") ? "stage:" : "phone:") + action + ":" + value;
    return '<button type="button" class="' + style + '" data-action="' + action +
      '" data-value="' + escape(value) + '" data-focus="' + escape(key) + '"' + (disabled ? ' disabled' : '') + '>' +
      escape(label) + '</button>';
  }

  function check(group, key, label, on) {
    const track = "setting:" + group + ":" + key;
    return '<label class="field-check"><input type="checkbox" name="' + key + '" data-setting="' +
      group + '" data-key="' + key + '" data-focus="' + track + '"' + (on ? " checked" : "") + '> ' +
      escape(label) + '</label>';
  }

  function choices(group, values, labels) {
    if(labels === zoneLabels) return '<p class="zone-note">Checked areas are No-Go Zones. '+(state.scene==='free'?'You can change all four areas.':'Only Entryway can be changed in the key and departure demos.')+'</p>'+Object.entries(zoneLabels).map(([key,label])=>'<label class="field-check"><input type="checkbox" data-setting="no-go" data-key="'+key+'"'+(!state.zones[key]?' checked':'')+(!canEditZone(key)?' disabled':'')+'> '+label+'</label>').join('');
    return Object.entries(labels).map(([key, label]) => check(group, key, label, values[key])).join("");
  }

  function autonomyOptions() {
    return '<option value="ask"' + (state.autonomy === "ask" ? " selected" : "") + '>Low-Profile</option>' +
      '<option value="balance" disabled>Balance · Demo unavailable</option><option value="suggest"' + (state.autonomy === "suggest" ? " selected" : "") + '>Proactive</option>';
  }

  function zoneCount() {
    return Object.values(state.zones).filter(Boolean).length;
  }

  function speak(text) {
    state.caption = text;
    state.speaker = 'Robot says'; state.speech = text;
    $("#announcement").textContent = text;
  }

  function chime() {
    if (!state.sound || !window.AudioContext) return;
    try {
      audio ||= new AudioContext();
      if (audio.state === "suspended") audio.resume().catch(() => {});
      const start = audio.currentTime;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(560, start);
      oscillator.frequency.setValueAtTime(730, start + .08);
      gain.gain.setValueAtTime(.075, start);
      gain.gain.exponentialRampToValueAtTime(.001, start + .25);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + .25);
    } catch {
      // Visual feedback and subtitles carry the same information.
    }
  }

  function addMessage(role, text, record = null, modality = 'text') {
    const message = { role, text, record, modality };
    state.messages[state.scene].push(message);
    if (role === "assistant") speak(text);
    return message;
  }

  function response(text, modality = 'text') {
    return addMessage("assistant", text, null, modality);
  }

  function formatTime(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return (hours % 12 || 12) + ":" + String(minutes).padStart(2, "0") + (hours < 12 ? " am" : " pm");
  }

  function setCamera(on) {
    state.camera = on;
    if (!on) {
      state.spotlight = false;
      if (stopMOS()) state.actionText = 'Motion stopped. Camera off.';
      if (state.flowRoom.gripJob?.item === 'napkin' && stopHomeGrip()) {
        state.actionText = 'Napkin delivery paused. Open the shutter to continue.';
      }
    }
    speak(on ? "Camera on in the allowed areas." : "Camera off. Visual observations have stopped.");
    chime();
    if (on) checkRainReminder();
  }

  function cameraIntent(text) {
    const phrase = text.normalize('NFKC').toLowerCase().trim()
      .replace(/^(?:hey\s+)?(?:mos|robin|莫斯)[\s,，:：]*/u, '')
      .replace(/[.!?。！？]+$/u, '').trim();
    const chinese = phrase.replace(/[\s,，]+/gu, '');
    const device = '(?:你的|演示的?|示範的?)?(?:摄像头|攝像頭|相机|相機|镜头|鏡頭|快门|快門)(?:的?(?:快门|快門))?';
    const matchesChinese = verb => new RegExp(
      '^(?:请|請|麻烦|麻煩)?(?:你)?(?:可以|能不能)?(?:帮我|幫我)?(?:先)?(?:' + verb + device + '|把' + device + verb + ')(?:一下)?(?:吧|好吗|好嗎|吗|嗎)?$'
    ).test(chinese);
    if (matchesChinese('(?:关闭|關閉|关掉|關掉|关上|關上|关一下|關一下|停用|关|關)')) return 'close';
    if (matchesChinese('(?:打开|打開|开启|開啟|开一下|開一下|启用|啟用|开|開)')) return 'open';
    const english = phrase.replace(/^please\s+/u,'');
    const target = '(?:the |your |demo |the demo )?(?:camera|shutter|camera shutter|lens cover)';
    if (new RegExp('^(?:(?:close|disable) ' + target + '|(?:turn|switch) off ' + target +
      '|(?:turn|switch) ' + target + ' off)(?: please)?$').test(english)) return 'close';
    if (new RegExp('^(?:(?:open|enable) ' + target + '|(?:turn|switch) on ' + target +
      '|(?:turn|switch) ' + target + ' on)(?: please)?$').test(english)) return 'open';
    return null;
  }

  function cameraReply(intent, text) {
    const zh = /\p{Script=Han}/u.test(text);
    if (intent === 'open') return zh ? '要打开摄像头，请手动点房间右上角的快门卡片。' :
      'To turn on the camera, click the shutter card in the room.';
    const wasOn = state.camera;
    setCamera(false);
    return zh ? (wasOn ? '已关闭摄像头。' : '摄像头已经是关闭状态。') :
      (wasOn ? 'I closed the camera shutter.' : 'The camera shutter is already closed.');
  }

  function handleCameraText(text, modality = 'text') {
    const intent = cameraIntent(text);
    if (!intent) return false;
    if (intent === 'close' && aiRequest) {
      aiRequest.abort();
      aiRequest = null;
      aiError = '';
    }
    addMessage('user', text, null, modality).ai = aiMode;
    const reply = cameraReply(intent, text);
    response(reply).ai = aiMode;
    if (aiMode && !aiRequest) aiHistory = [
      ...aiHistory, {role:'user',content:text}, {role:'assistant',content:reply}
    ].slice(-12);
    return true;
  }

  function stopVoice() {
    const active = voiceRequest;
    voiceRequest = null;
    clearTimeout(voiceTimer);
    voiceStatus = '';
    if (active) {
      try { active.abort(); } catch { /* The browser may have already stopped listening. */ }
    }
  }

  function sendChatMessage(text, modality = 'text') {
    if (handleCameraText(text,modality) || handleHomeSceneText(text,modality)) {
      render();
      return;
    }
    if (aiMode) {
      if (modality === 'voice' && (aiRequest || state.chatDraft.trim())) {
        state.chatDraft = [state.chatDraft.trim(),text].filter(Boolean).join(' ').slice(0,1200);
        state.chatDraftModality = 'voice';
        voiceStatus = aiRequest ? '语音已识别，等 MOS 回复后即可发送。' : '语音已加入输入框，可核对后发送。';
        render();
        return;
      }
      void submitAI(text,modality);
      return;
    }
    addMessage('user', text, null, modality);
    state.freeReference = '';
    response(/\p{Script=Han}/u.test(text) ? '连接 MOS Chat 后，我就可以回复你的消息。' :
      'Connect MOS Chat to get a reply to your message.');
    render();
  }

  function toggleVoice() {
    if (voiceRequest) {
      voiceStatus = '正在识别语音…';
      try { voiceRequest.stop(); } catch {
        stopVoice();
        voiceStatus = '无法完成语音识别，可再试一次或输入文字。';
      }
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      voiceStatus = '此浏览器未提供语音识别，可使用键盘听写或输入文字。';
      return;
    }
    let active;
    try { active = new Recognition(); } catch {
      voiceStatus = '无法启动语音识别，可使用键盘听写或输入文字。';
      return;
    }
    active.lang = 'zh-CN';
    active.continuous = false;
    active.interimResults = false;
    voiceRequest = active;
    voiceStatus = '正在启动麦克风…';
    const finish = status => {
      if (voiceRequest !== active) return;
      stopVoice();
      voiceStatus = status;
      render();
    };
    active.onstart = () => {
      if (voiceRequest !== active) return;
      voiceStatus = '正在听。说完可再点麦克风结束。';
      render();
    };
    active.onresult = event => {
      if (voiceRequest !== active) return;
      const result = event.results[event.resultIndex];
      if (!result?.isFinal) return;
      const text = String(result[0]?.transcript || '').trim().slice(0,aiMode ? 1200 : 240);
      stopVoice();
      if (text) sendChatMessage(text,'voice');
      else {
        voiceStatus = '没有识别到语音，可再试一次或输入文字。';
        render();
      }
    };
    active.onerror = event => finish(['not-allowed','service-not-allowed','audio-capture'].includes(event.error) ?
      '麦克风或语音服务不可用，可使用键盘听写或输入文字。' :
      '语音识别失败，可再试一次或输入文字。');
    active.onend = () => finish('没有听到指令。再点一次麦克风即可重试。');
    try {
      voiceTimer = setTimeout(() => finish('语音已结束。再点一次麦克风即可重试。'), 25000);
      active.start();
    } catch {
      finish('无法启动语音识别，可使用键盘听写或输入文字。');
    }
  }

  function voiceControl() {
    return '<button type="button" class="voice-input-button" data-action="voice-message" data-focus="voice-message"' +
      ' aria-label="Send a voice message" aria-pressed="' + Boolean(voiceRequest) + '" title="Speak to MOS">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">' +
      '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg></button>';
  }

  function observe() {
    if (!state.camera || !state.zones.entry) {
      response(state.camera ? "The entryway is outside the allowed area. No observation was saved." :
        "The camera is off. No observation was saved.");
      return;
    }
    state.records.keys = keyRecord;
    response("Sample observation saved for the entryway at 8:10 am.");
  }

  function findKeys() {
    if (state.records.keys && state.zones.entry) {
      state.spotlight = state.camera;
      addMessage("assistant", "Last seen at 8:10 am, on the left side of the entryway tray.", state.records.keys);
      chime();
      return;
    }
    state.spotlight = false;
    response(state.zones.entry ? "No observation available for your keys." :
      "The entryway is outside the allowed area. No observation is available.");
  }

  function departureAdvice(forDoorEvent = false) {
    const parts = [];
    const evidence = [];
    if (state.sources.calendar) {
      parts.push("You have a seminar at 9:00 am.");
      evidence.push(["Calendar", "Seminar at 9:00 am"]);
    }
    if (state.sources.items) {
      parts.push("Check your student card.");
      evidence.push(["Item checklist", "Student card on your seminar checklist. Current location unverified."]);
    }
    const coveredByReminder = forDoorEvent && state.rainReminder?.date === localDate();
    if (state.sources.weather && state.demoWeather === 'rain' && !coveredByReminder) {
      parts.push("Take an umbrella. Rain is likely.");
      evidence.push(["Demo weather", "Rain expected today"]);
    }
    return { text: parts.join(" "), evidence };
  }

  function simulateDeparture() {
    if (state.doorOpen) return;
    stopHomeGrip();
    delete state.flowRoom.target;
    state.doorOpen = true;
    state.departure = null;
    state.panel = "chat";
    state.choiceDone = false;
    state.actionText = state.zones.entry ? "You step to the doorway. Robin moves over to see you off." :
      "You step to the doorway. Robin stays outside the restricted entryway.";
    const advice = departureAdvice(true);
    if (state.autonomy === "suggest" && advice.text) {
      state.departure = { ...advice, status: "pending" };
      speak(advice.text);
      chime();
    } else {
      speak("Have a good day.");
    }
  }

  function returnHome() {
    if (!state.doorOpen) return;
    stopMOS();
    stopHomeGrip();
    delete state.flowRoom.target;
    state.doorOpen = false;
    state.departure = null;
    state.panel = "chat";
    state.choiceDone = false;
    state.actionText = "You step back inside and close the front door.";
    speak("Welcome home.");
  }

  function localDate(date = new Date()) {
    const month = String(date.getMonth() + 1).padStart(2,'0');
    const day = String(date.getDate()).padStart(2,'0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function scheduleTimedReminder(command, text) {
    const zh = /\p{Script=Han}/u.test(text);
    const title = typeof command.title === 'string' ? command.title.trim().slice(0,240) : '';
    if (!title || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(command.time) ||
        !['today','tomorrow','next'].includes(command.day)) {
      return zh ? '请告诉我提醒内容和具体时间。' : 'Tell me what and when to remind you.';
    }
    const now = new Date(), due = new Date(now);
    const [hours,minutes] = command.time.split(':').map(Number);
    due.setHours(hours,minutes,0,0);
    if (command.day === 'today' && due <= now) return zh ?
      '今天的这个时间已过，请换个时间。' : 'That time has passed today. Choose another time.';
    if (command.day === 'tomorrow' || (command.day === 'next' && due <= now)) due.setDate(due.getDate() + 1);
    const date = localDate(due);
    if (!state.reminders.some(item => item.title === title && item.date === date && item.time === command.time)) {
      state.reminders.push({id:state.nextReminderId++, title, time:command.time, date, zh, fired:false});
    }
    const when = date === localDate(now) ? (zh ? '今天' : 'today') : (zh ? '明天' : 'tomorrow');
    return zh ? `已设置${when} ${command.time} 的提醒：${title}。` :
      `I’ll remind you ${when} at ${formatTime(command.time)}: ${title}.`;
  }

  function scheduleRainReminder(command, text) {
    if (typeof command.bring_umbrella !== 'boolean') throw new Error('Invalid rain reminder');
    const date = localDate(), zh = /\p{Script=Han}/u.test(text);
    const active = state.rainReminder?.date === date ? state.rainReminder : {date, notified:false, delivered:false};
    state.rainReminder = {...active, zh, bring:command.bring_umbrella};
    if (zh) return '已设置今天的提醒。你走到门边时，如果演示预报有雨，我会提醒你带伞' +
      (command.bring_umbrella ? '，条件允许时把伞递给你。' : '。');
    return 'Reminder set for today. I’ll remind you to take an umbrella at the door if the demo forecast predicts rain' +
      (command.bring_umbrella ? ' and hand it to you when possible.' : '.');
  }

  function reminderNotice(text) {
    response(text).ai = aiMode;
    if (state.panel !== 'chat') appFeedback(text);
  }

  function renderReminder() {
    const draft = $('#chat-input')?.value;
    render();
    if (draft && $('#chat-input')) $('#chat-input').value = draft;
  }

  function checkTimeReminders() {
    const now = new Date();
    const date = localDate(now);
    const minute = now.getHours() * 60 + now.getMinutes();
    let fired = false;
    for (const reminder of state.reminders) {
      if (reminder.date !== date || reminder.fired) continue;
      const [hours,minutes] = reminder.time.split(':').map(Number);
      if (hours * 60 + minutes > minute) continue;
      reminder.fired = true;
      reminderNotice(reminder.zh ? `提醒你：${reminder.title}。` : `Reminder: ${reminder.title}.`);
      fired = true;
    }
    if (fired) {
      chime();
      renderReminder();
    }
  }

  function roomControlScene() {
    return state.scene === 'free' || state.scene === 'leaving';
  }

  function residentArea() {
    if (state.scene === 'leaving') return 'entry';
    return state.scene === 'free' ? state.freeActor.zone : currentResidentZone() || 'living';
  }

  function receivedRoomItems() {
    return state.flowRoom.keysCollected && state.mosHeld !== 'keys' && !state.mosReceived.includes('keys') ?
      [...state.mosReceived,'keys'] : state.mosReceived;
  }

  function checkRainReminder() {
    const rule = state.rainReminder;
    if (!rule || rule.date !== localDate() || !state.sources.weather || state.demoWeather !== 'rain' ||
        !roomControlScene() || (state.scene === 'leaving' && !state.doorOpen) || !residentAtDoor()) return false;
    const hasUmbrella = state.mosReceived.includes('umbrella');
    const access = state.zones.entry && state.zones[residentArea()];
    const ready = access && state.camera && !state.mosGrip && !state.flowRoom.gripJob &&
      !state.flowRoom.heldItem && (!state.mosHeld || state.mosHeld === 'umbrella');
    let changed = false;
    if (!rule.notified) {
      let notice = rule.zh ? '今天的演示预报有雨，出门记得带伞。' : 'Rain is expected in today’s demo forecast. Take an umbrella.';
      if (rule.bring && !rule.delivered) {
        if (hasUmbrella) notice += rule.zh ? ' 伞已经在你手里。' : ' You already have the umbrella.';
        else if (!access) notice += rule.zh ? ' 玄关允许进入后，我可以把伞递给你。' :
          ' I can hand it over when the entryway is allowed.';
        else if (!state.camera) notice += rule.zh ? ' 手动打开快门后，我可以把伞递给你。' :
          ' Open the shutter by hand and I can bring it over.';
        else if (ready) notice += rule.zh ? ' 我现在把伞拿给你。' : ' I’ll bring it to you now.';
      }
      reminderNotice(notice);
      rule.notified = true;
      chime();
      changed = true;
    }
    if (!rule.bring || rule.delivered) return changed;
    if (hasUmbrella) {
      rule.delivered = true;
      return true;
    }
    if (ready) {
      runMOSCommand({action:'bring',item:'umbrella'}, rule.zh ? '把雨伞拿给我' : 'Bring me the umbrella');
      if (state.mosGrip?.item === 'umbrella' && state.mosGrip.delivery) {
        state.mosGrip.rainDate = rule.date;
        return true;
      }
    }
    return changed;
  }

  function reviewReminder(match) {
    let hour = Number(match[2]);
    const minute = Number(match[3] || 0);
    const meridiem = match[4]?.toLowerCase();
    const title = match[1].trim();
    if (!title) {
      response("What should I remind you about?");
      return;
    }
    if (hour > 23 || minute > 59 || (meridiem && (hour < 1 || hour > 12))) {
      response("Please enter a valid time, such as 8 pm or 20:30.");
      return;
    }
    if (meridiem) hour = hour % 12 + (meridiem === "pm" ? 12 : 0);
    state.pendingReminder = {
      scene: state.scene,
      title,
      time: String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0")
    };
    speak("Review the reminder before saving it.");
  }

  function stopMOS(retreat = false) {
    state.mosQueue = [];
    if (!state.mosTarget && !state.mosGrip) return false;
    state.mosTarget = null;
    state.mosMode = null;
    state.mosGrip = null;
    state.freeTarget = retreat ? 'idle' : 'hold';
    return true;
  }

  function gripAtResident() {
    return state.mosGrip?.action === 'handover' || state.mosGrip?.action === 'take_back';
  }

  function mosDestinationZone() {
    return gripAtResident() || state.mosTarget === 'resident' ?
      residentArea() : roomTargets[state.mosTarget]?.zone;
  }

  function markingResident() {
    return state.mosTarget === 'resident' && state.mosMode === 'locate';
  }

  function gripItemAction(grip) {
    if (grip?.delivery) return 'bring';
    if (grip?.action === 'take_back' || grip?.action === 'put_back') return 'put_back';
    return null;
  }

  function itemActionNeeded(action, item, received) {
    return action === 'bring' ? !received.includes(item) : state.mosHeld === item || received.includes(item);
  }

  function itemActionLabel(action, item, zh) {
    const name = zh ? items[item].zh : items[item].label;
    return action === 'put_back' ? (zh ? '放回' : 'Put back ') + name : (zh ? '递给你' : 'Bring ') + name;
  }

  function enqueueItemActions(steps, text) {
    if (!Array.isArray(steps) || !steps.length || steps.length > 2 * Object.keys(items).length ||
        steps.some(step => !step || !['bring','put_back'].includes(step.action) ||
          !Object.hasOwn(items,step.item))) throw new Error('Invalid item queue');
    const zh = /\p{Script=Han}/u.test(text);
    const active = state.mosGrip;
    const activeAction = gripItemAction(active);
    if (active && !activeAction) {
      return zh ? '机械手还在动作中，等它完成后再试。' : 'The gripper is still moving. Try again when it finishes.';
    }
    const planned = active ? [{action:activeAction,item:active.item},...state.mosQueue] : state.mosQueue;
    const positions = new Map(receivedRoomItems().map(item => [item,'resident']));
    if (state.mosHeld) positions.set(state.mosHeld,'gripper');
    for (const {action,item} of planned) positions.set(item,action === 'bring' ? 'resident' : 'home');
    const requested = [];
    for (const {action,item} of steps) {
      const destination = action === 'bring' ? 'resident' : 'home';
      if ((positions.get(item) || 'home') === destination) continue;
      requested.push({action,item,text});
      positions.set(item,destination);
    }
    if (!requested.length) {
      return zh ? '这些动作已经排队，或物品已经在指定位置。' :
        'Those actions are already queued, or the items are already where you asked for them.';
    }
    const mixed = Boolean(active?.mixedQueue) || new Set([...planned,...requested].map(job => job.action)).size > 1;
    const names = requested.map(({action,item}) =>
      mixed ? itemActionLabel(action,item,zh) : zh ? items[item].zh : items[item].name).join(' → ');
    if (active) {
      active.queuedItem = true;
      active.mixedQueue = mixed;
      state.mosQueue.push(...requested);
      return zh ? `已追加到队尾：${names}。` : `Added to the end of the queue: ${names}.`;
    }
    const [first,...remaining] = requested;
    const reply = runMOSCommand(first,text);
    if (gripItemAction(state.mosGrip) !== first.action || state.mosGrip.item !== first.item || !remaining.length) return reply;
    state.mosGrip.queuedItem = true;
    state.mosGrip.mixedQueue = mixed;
    state.mosQueue.push(...remaining);
    if (mixed) return zh ? `我会按顺序执行：${names}。` : `I’ll do these in order: ${names}.`;
    if (first.action === 'put_back') return zh ? `我会按顺序放回原位：${names}。` : `I’ll put these back in order: ${names}.`;
    return zh ? `我会按顺序递给你：${names}。` : `I’ll hand these to you in order: ${names}.`;
  }

  function continueItemQueue(mixed) {
    const received = receivedRoomItems();
    let next = state.mosQueue.shift();
    while (next && !itemActionNeeded(next.action,next.item,received)) next = state.mosQueue.shift();
    if (!next) return;
    const {action,item,text} = next;
    const reply = runMOSCommand({action,item},text);
    if (gripItemAction(state.mosGrip) === action && state.mosGrip.item === item) {
      state.mosGrip.queuedItem = true;
      state.mosGrip.mixedQueue = mixed;
      response(reply).ai = aiMode;
    } else {
      state.mosQueue = [];
      const zh = /\p{Script=Han}/u.test(text);
      const message = mixed ? (zh ? '物品队列已停止。' : 'I stopped the item queue. ') :
        action === 'put_back' ? (zh ? '归还队列已停止。' : 'I stopped the return queue. ') :
        (zh ? '取物队列已停止。' : 'I stopped the delivery queue. ');
      response(message + reply).ai = aiMode;
    }
  }

  function runMOSCommand(command, text) {
    if (command?.action === 'close_camera') return cameraReply(cameraIntent(text) === 'open' ? 'open' : 'close', text);
    if (command?.action === 'set_time_reminder') return scheduleTimedReminder(command,text);
    if (command?.action === 'set_rain_departure_reminder') return scheduleRainReminder(command,text);
    if (command?.action === 'queue_items') return enqueueItemActions(command.steps,text);
    if (command?.action === 'queue_delivery' || command?.action === 'queue_return') {
      const action = command.action === 'queue_delivery' ? 'bring' : 'put_back';
      const steps = Array.isArray(command.items) ? command.items.map(item => ({action,item})) : null;
      return enqueueItemActions(steps,text);
    }
    const actions = roomControlScene() ? ['locate','pick_up','put_back','bring','stop','look_at','move_to'] :
      ['bring','put_back','stop'];
    if (!command || !actions.includes(command.action)) {
      throw new Error('Invalid room command');
    }
    const zh = /[\p{Script=Han}]/u.test(text);
    const say = (en, cn) => zh ? cn : en;
    const { action } = command;
    if (action === 'stop') {
      const stopped = stopHomeGrip() || stopMOS();
      if (stopped) state.actionText = 'Motion stopped.';
      return stopped ? say('I stopped the motion.', '已停止移动。') : say('I’m already still.', '机器人现在没有在移动。');
    }
    if (state.mosGrip && ['bring','put_back'].includes(action) && Object.hasOwn(items,command.item)) {
      return enqueueItemActions([{action,item:command.item}],text);
    }
    if (state.flowRoom.gripJob) return say('The gripper is still moving.', '机械手还在动作中，请稍等。');
    if (state.flowRoom.heldItem && ['bring','pick_up','put_back'].includes(action)) {
      return say('I’m holding the napkin. Ask me to finish handing it to you first.', '机械手正拿着餐巾纸，请先让我把它递给你。');
    }
    const bringing = action === 'bring';
    const returning = action === 'put_back';
    const looking = action === 'look_at';
    const moving = action === 'move_to';
    const locating = action === 'locate';
    const received = receivedRoomItems();
    const id = command.item || (returning ? state.mosHeld || received.at(-1) : state.mosTarget);
    if (!id || !Object.hasOwn(roomTargets, id)) return say('What should I look for or move toward?', '你指的是房间里的哪个物品或位置？');
    const item = roomTargets[id];
    const residentOnMap = locating && id === 'resident';
    const portable = Object.hasOwn(items, id);
    if (!portable && !(looking || moving || locating)) {
      return say('I can move toward room fixtures and look at them. The gripper can handle the glasses, umbrella, keys, and backpack.',
        '我可以靠近或看向房间里的固定物件。夹爪能拿取的是眼镜、雨伞、钥匙和书包。');
    }
    const held = items[state.mosHeld];
    if (state.mosGrip) return say('The gripper is still moving. Give it a moment or stop the motion.', '机械手还在动作中，稍等一下，也可以先让它停下。');
    const withResident = received.includes(id);
    if (withResident && !returning) return say(`I already handed you the ${item.name}.`, `我已经把${item.zh}交给你了。`);
    const takingBack = returning && withResident;
    const hasItem = id === state.mosHeld;
    if (hasItem && !bringing && !returning) return say(`I’m holding the ${item.name}.`, `机械手已经拿着${item.zh}了。`);
    if ((action === 'pick_up' || bringing || takingBack) && held && !hasItem) return say(`I’m holding the ${held.name}. Ask me to put it back first.`, `机械手正拿着${held.zh}，请先让我把它放回去。`);
    if (returning && !hasItem && !withResident) return say(`The ${item.name} ${item.name === 'keys' || item.name === 'glasses' ? 'are' : 'is'} already in the original spot.`, `${item.zh}已经在原位了。`);
    if (!state.camera && !(looking || moving || (locating && !portable))) {
      return say('Click the shutter card in the room to turn on the demo camera.', '请先点房间右上角的快门卡片打开相机，再让我操作房间里的物品。');
    }
    const itemZone = residentOnMap ? currentResidentZone() || residentArea() :
      id === 'resident' ? residentArea() : item.zone;
    const blocked = (bringing || takingBack) && !state.zones[residentArea()] ? residentArea() :
      !state.zones[itemZone] && !residentOnMap && !(bringing && hasItem) ? itemZone : null;
    if (blocked) {
      const zone = zoneLabelsZh[blocked];
      return say(`${zoneLabels[blocked]} is marked as a No-Go Zone. Allow access in Demo options first.`,
        `${zone}目前是禁入区，请先在演示设置里允许进入。`);
    }
    state.mosTarget = id;
    state.mosMode = looking || moving || locating ? action : null;
    const targetName = id === 'resident' ? 'you' : 'the ' + item.name;
    if (looking) {
      state.actionText = `Turns the lens toward ${targetName}.`;
      return say(`I’ll turn toward ${targetName}.` + (state.camera ? '' : ' The shutter is closed.'),
        `我会把镜头转向${item.zh}。` + (state.camera ? '' : '相机快门现在是关着的。'));
    }
    if (moving) {
      state.actionText = `Moves along the rail toward ${targetName}.`;
      return say(`I’ll move along the rail toward ${targetName}.`,
        id === 'resident' ? '我会沿轨道到你身边。' : `我会沿轨道移动到${item.zh}附近。`);
    }
    if (locating && !portable) {
      state.actionText = `Marks the position of ${targetName}.`;
      if (residentOnMap) return say(`You’re in the ${zoneLabels[itemZone].toLowerCase()}. I’ll mark your position on the map.`,
        `你在${zoneLabelsZh[itemZone]}。我会在地图上标出你的位置。`);
      return say(`The ${item.name} is ${item.place}. I’ll mark the spot in the room.`,
        `${item.zh}在${item.placeZh}。我会在房间里标出位置。`);
    }
    if (locating) {
      state.actionText = `Points to the ${item.name} ${item.place}.`;
      return say(`The ${item.name} ${id === 'keys' || id === 'glasses' ? 'are' : 'is'} ${item.place}. I’ll point to the spot.`,
        `${item.zh}在${item.placeZh}，我会移动过去，用灯标出位置。`);
    }
    if (bringing) {
      state.mosGrip = { action:hasItem ? 'handover' : 'pick_up', item:id, delivery:true, zh };
      state.actionText = hasItem ? `Carries the ${item.name} to you.` : `Moves to the ${item.name}, then brings it to you.`;
      return say(`I’ll bring you the ${item.name}.`, `我会把${item.zh}拿给你。`);
    }
    state.mosGrip = { action: takingBack ? 'take_back' : action, item: id, zh };
    if (action === 'pick_up') {
      state.actionText = `Moves to the ${item.name} and lowers the gripper.`;
      return say(`I’ll pick up the ${item.name}.`, `我会用机械手拿起${item.zh}。`);
    }
    if (takingBack) {
      state.actionText = `Takes the ${item.name} from you, then returns it to its original spot.`;
      return say(`I’ll take the ${item.name} from you and put it back.`, `我会从你手里接过${item.zh}，再放回原位。`);
    }
    state.actionText = `Returns the ${item.name} to its original spot.`;
    return say(`I’ll put the ${item.name} back.`, `我会把${item.zh}放回原位。`);
  }

  async function submitAI(text, modality = 'text') {
    if (aiRequest) return;
    const stateAtSend = state;
    const sceneAtSend = state.scene;
    const controller = new AbortController();
    aiRequest = controller;
    aiError = '';
    state.freeReference = '';
    const userMessage = addMessage('user', text, null, modality);
    render();
    const user = {role:'user', content:text};
    const received = receivedRoomItems();
    const room = {
      held:state.mosHeld || '', focused:state.mosTarget || received.at(-1) || '',
      received, ...(roomControlScene() ? {navigation:true} : {})
    };
    const messages = [user];
    const encodeChat = messages => JSON.stringify({
      messages, room, camera_control:true, reminder_control:true, delivery_queue:true, return_queue:true,
      mixed_item_queue:true
    });
    for (let i = aiHistory.length - 2; i >= Math.max(0, aiHistory.length - 10); i -= 2) {
      const candidate = [aiHistory[i], aiHistory[i + 1], ...messages];
      if (new TextEncoder().encode(encodeChat(candidate)).length > 31000) break;
      messages.unshift(aiHistory[i], aiHistory[i + 1]);
    }
    const stillCurrent = () => state === stateAtSend && state.scene === sceneAtSend && aiRequest === controller;
    const headers = {'Content-Type':'application/json'};
    if (memoryProfile) headers['X-MOS-Profile'] = memoryProfile;
    try {
      const result = await fetch('./ai/chat', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers, body: encodeChat(messages)
      });
      if (!stillCurrent()) return;
      if (result.status === 401) {
        aiError = 'Sign in to reconnect.';
      } else if (result.status === 409) {
        window.location.reload();
      } else if (result.status === 429) {
        aiError = 'AI is busy. Try again in a moment.';
      } else if (!result.ok) {
        aiError = 'AI could not reply. Please try again.';
      } else {
        const message = await result.json();
        if (!stillCurrent()) return;
        const reply = message.command ? runMOSCommand(message.command, text) : message.reply;
        if (typeof reply !== 'string' || !reply.trim()) throw new Error('Empty reply');
        userMessage.ai = true;
        addMessage('assistant', reply).ai = true;
        aiHistory = [...messages, {role:'assistant',content:reply}].slice(-12);
        if (message.command?.action === 'set_rain_departure_reminder') checkRainReminder();
      }
    } catch {
      if (stillCurrent()) aiError = 'AI could not reply. Please try again.';
    } finally {
      if (stillCurrent()) {
        aiRequest = null;
        render();
      }
    }
  }

  function handlePrompt(text) {
    const value = text.trim();
    if (!value) return;
    state.panel = "chat";
    addMessage("user", value);
    const escapedAlias = state.alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const query = escapedAlias ? value.replace(new RegExp("^(?:hey )?" + escapedAlias + "[ ,:]+", "i"), "") : value;
    const reminder = query.match(/^remind me to\s+(.+?)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?[.!?]?$/i);
    if (reminder) reviewReminder(reminder);
    else if (/\bkeys?\b/i.test(query)) findKeys();
    else if (/\b(take|leav(?:e|ing)|umbrella|student card)\b/i.test(query)) {
      response(departureAdvice().text || "Enable a source in Settings to get help preparing to leave.");
    } else {
      response("Try asking about your keys, what to take, or creating a reminder for a specific time.");
    }
  }

  function setting(group, key, value) {
    if (group === "zones") {
      state.zones[key] = value;
      if (!value && state.flowRoom.gripJob && blockedHomeGrip(state.flowRoom.gripJob)) {
        stopHomeGrip(true);
        state.actionText = 'Stops the current action because an area became a No-Go Zone.';
      }
      if (key === "entry" && !value) state.spotlight = false;
      const residentPending = state.mosGrip?.delivery && residentArea() === key;
      const returnPending = state.mosGrip?.action === 'take_back' && items[state.mosGrip.item].zone === key;
      if (!value && !markingResident() && (mosDestinationZone() === key || residentPending || returnPending) && stopMOS(true)) {
        state.actionText = 'Returns to the shared area because the destination became a No-Go Zone.';
      }
      if(key === 'entry' && !value && state.scene === 'free' && state.freeTarget === 'entry'){state.freeTarget='idle';state.actionText='Leaves the entryway to respect the updated No-Go Zone.';}
      if(!value && state.scene==='free' && state.freeTarget===({study:'park',living:'sofa',private:'private'})[key]){state.freeTarget='idle';state.actionText='Returns to the shared area to respect the updated No-Go Zone.';}
      if (value) checkRainReminder();
      return;
    }
    if (group === "sources") {
      state.sources[key] = value;
      if (key === 'weather' && !value && state.mosGrip?.rainDate) stopMOS();
      if (state.departure?.status === "pending") {
        const advice = departureAdvice(true);
        state.departure = advice.text ? { ...advice, status: "pending" } : null;
        speak(advice.text || "No allowed sources remain for this departure.");
      }
      if (key === 'weather' && value) checkRainReminder();
      return;
    }
    if (group === "autonomy" && value === "ask" && state.departure?.status === "pending") {
      state.departure = null;
      speak("Proactive suggestions paused.");
    }
    state[group] = value;
  }

  function recordDetails(record) {
    return '<details class="observation"><summary>Observation details</summary><dl>' +
      '<dt>Last seen</dt><dd>' + escape(record.time) + '</dd><dt>Area</dt><dd>' + escape(record.zone) +
      '</dd><dt>Source</dt><dd>' + escape(record.source) + '</dd></dl></details>';
  }

  function messageMarkup(message) {
    return '<div class="message ' + message.role + (message.role === 'user' && message.modality === 'voice' ? ' voice-message' : '') + '"><span class="sr-only">' +
      (message.role === "user" ? "You: " : "Companion: ") + '</span>' + (message.role === 'user' && message.modality === 'voice' ? '<span class="voice-transcript" title="Voice message" aria-label="Voice message"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg></span>' : '') + escape(message.text) +
      (message.screenshot ? '<div class="shared-exam-image"><small>SCREENSHOT · CAMPUS MAIL</small><b>Computer Science Examination</b><p>Tomorrow · 9:00 AM</p></div>' : '') +
      (message.record ? recordDetails(message.record) : "") + '</div>';
  }

  function departureMarkup() {
    const departure = state.departure;
    if (state.scene !== "leaving" || !departure) return "";
    if (departure.status !== "pending") {
      return '<div class="detail-box">' + (departure.status === "accepted" ? "Departure suggestion acknowledged." :
        "Departure suggestion dismissed.") + '</div>';
    }
    const evidence = [["Door sensor", "Entryway door opened"], ...departure.evidence];
    return '<div class="detail-box"><strong>Before you go</strong><p>' + escape(departure.text) + '</p>' +
      '<details><summary>Why now?</summary><dl>' + evidence.map(([label, info]) =>
        '<dt>' + escape(label) + '</dt><dd>' + escape(info) + '</dd>').join("") + '</dl></details>' +
      '<div class="inline-actions">' + button("departure-result", "Got it", { value: "accepted", style: "phone-button primary" }) +
      button("departure-result", "Dismiss", { value: "dismissed" }) + button("adjust", "Adjust") + '</div></div>';
  }

  function reminderPreview() {
    const draft = state.pendingReminder;
    if (!draft || draft.scene !== state.scene) return "";
    return '<form class="detail-box" data-form="reminder"><strong>Review reminder</strong><p>' + escape(draft.title) + '</p>' +
      '<label for="reminder-time">Time</label><input id="reminder-time" type="time" name="time" value="' + escape(draft.time) +
      '" data-focus="reminder-time" required><div class="inline-actions"><button class="phone-button primary" type="submit">Confirm reminder</button>' +
      button("cancel-reminder", "Cancel") + '</div></form>';
  }

  function chat() {
    if(state.scene === "exam") {
      const shot=window.companionFlows.exam[state.flowIndex];
      if(shot && ['mail','screenshot','share'].includes(shot.view)) return examMail(shot.view);
    }
    const quick = { keys: ["keys"], leaving: ["leaving"], privacy: ["reminder"], setup: ["reminder"] };
    const messages = state.messages[state.scene];
    return '<div class="chat-layout"><div class="transcript" aria-label="Conversation">' +
      '<div class="chat-date">Yesterday</div>' + [
        { role: "user", text: "Robin, can you check whether I turned off the gas?" },
        { role: "assistant", text: "I cannot confirm that safely from here. Please check the stove directly before you leave." },
        { role: "user", text: "Just checked. It is off. Also, did I leave the remote on the sofa earlier?" },
        { role: "assistant", text: "The last saved observation showed it beside the cushion. That was earlier, so it may have moved." },
        { role: "user", text: "Found it. Remember that I want to go to bed earlier and get up earlier." },
        { role: "assistant", text: "How about winding down at 10:30 pm and getting up at 7?" },
        { role: "user", text: "Sounds good. Remind me every day." },
        { role: "assistant", text: "Done. Both reminders are in Memory. We can adjust them whenever you like." }
      ].map(messageMarkup).join("") + '<div class="chat-date">Today</div>' +
      messageMarkup({ role: "assistant", text: scenes[state.scene].greeting }) + messages.map(messageMarkup).join("") +
      (state.scene === "keys" && state.spotlight ?
        '<div class="inline-actions">' + button("found", "Found it", { style: "phone-button primary" }) + '</div>' : "") +
      departureMarkup() + reminderPreview() + '</div>' +
      '<div class="chat-bottom">' +
      (aiMode ? '<div class="ai-chat-status"><span role="status">' +
        escape(aiRequest ? 'Robin is replying…' : aiError || (state.scene === 'free' ? 'MOS controls' : 'MOS Chat')) +
        '</span><a href="./ai/connect">Reconnect</a></div>' :
        '<div class="ai-chat-status"><a href="./ai/connect">Connect AI</a></div>') +
      (aiMode && state.scene === 'free' ? mosChatActions() : '') +
      (voiceStatus ? '<p class="voice-status" role="status">' + escape(voiceStatus) + '</p>' : '') +
      '<div class="chip-list">' + (quick[state.scene] || []).map(key =>
        button("prompt", commands[key], { style: "chip", value: key })).join("") +
      '</div>' + (state.scene === 'exam' && window.companionFlows.exam[state.flowIndex]?.view === 'attachment' ? '<div class="screenshot-attachment"><b>Exam notice · Screenshot</b><small>PNG image · From Campus Mail</small></div>' : '') + (state.examReference && state.scene === 'exam' ? '<div class="screenshot-attachment"><b>Reference Memory</b><small>Wake up for exam · Tomorrow 7:00 am</small></div>' : '') + '<form class="composer" data-form="chat"><label class="sr-only" for="chat-input">Message the companion</label>' +
      '<input id="chat-input" data-focus="chat-input" name="message" maxlength="' + (aiMode ? 1200 : 240) +
      '" type="text" autocomplete="off" placeholder="Message Robin" value="' + escape(state.chatDraft) + '"' +
      (aiRequest ? ' disabled' : '') + '>' +
      '<button type="button" class="attachment-button" aria-label="Add attachment">+</button><button type="submit" class="phone-button primary" aria-label="Send"' +
      (aiRequest ? ' disabled' : '') + '>↑</button></form></div></div>';
  }

  function mosChatActions() {
    const available = Object.entries(items).filter(([id]) => !state.mosReceived.includes(id));
    const options = available.map(([,item]) => [`Find ${item.name}`, `Find the ${item.name}`]);
    options.push(['Look at computer', 'Look at the computer']);
    const held = items[state.mosHeld], focused = items[state.mosTarget];
    const delivery = held || focused || available[0]?.[1];
    const returning = held || items[state.mosReceived.at(-1)];
    if (delivery) options.push([`Bring me the ${delivery.name}`, `Bring me the ${delivery.name}`]);
    if (returning) options.push([`Put back ${returning.name}`, `Put the ${returning.name} back`]);
    if (!held && focused) options.push([`Pick up ${focused.name}`, `Pick up the ${focused.name}`]);
    return '<div class="mos-chat-actions" aria-label="Room commands">' + options.map(([label, value]) =>
      button('mos-prompt', label, { style:'chip', value, disabled:Boolean(aiRequest) })).join('') + '</div>';
  }

  function reminders() {
    const rows=state.reminders.map(reminder=>({
      title:reminder.title,
      meta:(reminder.date ? reminder.date + ' · ' : '') + formatTime(reminder.time),
      description:reminder.fired ? 'Reminder sent' : reminder.date && reminder.date < localDate() ? 'Expired' :
        reminder.status || 'Scheduled · Remind me at the chosen time.',
      remove:['delete-reminder',reminder.id]
    }));
    const rain = state.rainReminder;
    if (rain) rows.unshift({
      title:rain.zh ? '雨天出门提醒' : 'Rain reminder at the front door',
      meta:rain.date + ' · ' + (rain.date !== localDate() ? 'Expired' :
        rain.delivered ? 'Umbrella delivered' : rain.notified ? 'Reminder sent' : 'Waiting for the door'),
      description:rain.zh ? '走到门边且演示预报有雨时提醒带伞。' + (rain.bring ? ' 权限允许时递伞。' : '') :
        'Remind me at the front door if the demo forecast predicts rain.' + (rain.bring ? ' Hand me the umbrella when possible.' : ''),
      remove:['cancel-rain-reminder','']
    });
    rows.push({title:'Take my medication',meta:'Every day · 8:00 am',description:'Always remind me, even in Low-Profile mode. Keep reminding until I confirm.'});
    if(state.scene==='free')rows.push({title:'Water the plants',meta:'Saturday · 10:00 am',description:'A gentle reminder to water the plants.'});
    const task={title:'Watch the room',meta:state.camera?'Active · Camera on':'Paused · Camera off',description:state.camera?'Keep an eye on the room while the camera is on. Respect all No-Go Zones.':'Room observation is paused while the camera is off.'};
    const record=state.records.keys;
    const storageStatus = memoryAvailable ? 'Chat, reminders and preferences are saved in this browser.' : 'Browser memory is unavailable.';
    return '<p class="panel-lead">' + storageStatus + '</p><button class="memory-demo-search" data-action="app-demo" data-value="Search is not available in this demo."><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg>Search Memory</button><span class="memory-section-label">Reminders</span>'+rows.map(memoryItem).join('')+'<span class="memory-section-label">Tasks</span>'+memoryItem(task)+(record?'<span class="memory-section-label">Observations</span>'+memoryItem({title:'Keys',meta:'Last seen · '+record.time,description:record.zone+' · '+record.source}):'');
  }

  function memoryItem(item){
    const remove = item.remove ? button(item.remove[0],'Delete',{value:item.remove[1]}) :
      button('app-demo','Delete',{value:'Deleting items is not available in this demo.'});
    return '<details class="memory-item"><summary><span class="memory-item-title">'+escape(item.title)+'</span><span class="memory-item-meta">'+escape(item.meta)+'</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></summary><div class="memory-item-body"><p>'+escape(item.description)+'</p><div class="memory-item-actions">'+button('reference-memory','Reference →',{value:item.title+' · '+item.meta})+button('app-demo','Adjust',{value:'Adjustments are not available in this demo. In the full app, you could change the details here or reference this item in chat.'})+remove+'</div></div></details>';
  }

  function settings() {
    const record = state.records.keys;
    return '<div class="settings-layout"><div><h3>Settings</h3><p class="panel-lead">Manage what the companion can use.</p></div>' +
      '<label class="field-label">Proactive help <select data-setting="autonomy" data-focus="autonomy">' +
      autonomyOptions() + '</select></label>' +
      '<fieldset class="control-group"><legend>Departure sources</legend>' + choices("sources", state.sources, sourceLabels) + '</fieldset>' +
      '<fieldset class="control-group"><legend>Camera</legend><div class="settings-privacy"><strong>' +
      (state.camera ? "Camera on" : "Camera off") + '</strong>' + button("shutter", state.camera ? "Close shutter" : "Open shutter") + '</div>' +
      '</fieldset><fieldset class="control-group"><legend>No-Go Zone</legend>'+choices("zones", state.zones, zoneLabels)+'</fieldset><fieldset class="control-group"><legend>Sound</legend>'+check('preferences','sound','Play a short notification sound',state.sound)+'</fieldset>' +
      '<fieldset hidden class="control-group"><legend>Observation history</legend>' + (record ?
        '<div class="detail-box"><strong>Keys</strong><p>Last seen at ' + escape(record.time) +
        ' · ' + escape(record.zone) + '</p><div class="inline-actions">' + button("delete-observation", "Delete record") + '</div></div>' :
        '<p class="zone-note">No observations saved.</p>') + '</fieldset>' + button("setup-open", "Edit setup") + '</div>';
  }

  function setup() {
    return '<form class="settings-layout setup-form" data-form="setup"><div><h3>Personalise your companion</h3>' +
      '<p class="panel-lead">Choose a wake name and the help you want at home.</p></div>' +
      '<label class="field-label">Bot’s name <input type="text" name="alias" maxlength="24" placeholder="e.g. Robin" value="' +
      escape(state.alias) + '"></label><label class="field-label">Proactive help <select name="autonomy">' +
      autonomyOptions() + '</select></label><fieldset class="control-group"><legend>Sound</legend>' +
      check("setup", "sound", "Play a short notification sound", state.sound) +
      '</fieldset><fieldset class="control-group"><legend>No-Go Zone</legend>' +
      choices("setup", state.zones, zoneLabels) + '<p class="zone-note">No-Go Zones restrict where Robin may travel. The camera switch is independent.</p>' +
      '</fieldset><div class="inline-actions"><button type="submit" class="phone-button primary">Save preferences</button>' +
      button("skip-setup", "Skip setup") + '</div></form>';
  }

  function keySearchRestriction() {
    if (!state.camera && !state.zones.entry) return "The demo camera is off and the entryway is a No-Go Zone.";
    if (!state.camera) return "The demo camera is off.";
    if (!state.zones.entry) return "The entryway is a No-Go Zone.";
    return "";
  }

  function homeSceneBusy() {
    return Boolean(state.flowRoom.gripJob || state.flowRoom.curtainJob);
  }

  function blockedHomeGrip(job) {
    const area = job.item === 'napkin' ?
      (job.action === 'pick_up' && !state.zones.living ? 'living' : residentArea()) : 'study';
    return state.zones[area] ? null : area;
  }

  function settleHomeGrip(retreat = false) {
    const target = retreat ? 'idle' : 'hold';
    state.flowRoom.gripJob = null;
    state.flowRoom.inspect = null;
    state.flowRoom.spotlight = false;
    state.spotlight = false;
    if (state.scene === 'free') state.freeTarget = target;
    else state.flowRoom.target = target;
  }

  function stopHomeGrip(retreat = false) {
    const job = state.flowRoom.gripJob;
    if (!job) return false;
    settleHomeGrip(retreat);
    if (job.item === 'napkin' && !state.flowRoom.receivedItems?.includes('napkin')) {
      state.flowRoom.napkinPaused = true;
    }
    return true;
  }

  function startHomeGrip(job) {
    stopMOS();
    state.residentSelected = false;
    state.spotlight = false;
    state.flowRoom.gripJob = job;
    state.flowRoom.napkinPaused = false;
  }

  function startHomeSceneAction(effect, {zh = false, chat = false, nextEffect} = {}) {
    const {lightsOn,curtainsClosed} = homeSceneCommands[effect];
    const say = (en, cn) => zh ? cn : en;
    const current = state.flowRoom;
    const napkin = effect === 'serve-napkin';
    const light = typeof lightsOn === 'boolean';
    const holdingNapkin = current.heldItem === 'napkin';
    const grip = napkin ? {action:holdingNapkin ? 'handover' : 'pick_up', item:'napkin', zh, chat} :
      light ? {action:'press_switch', lightsOn, zh, chat, nextEffect} : null;
    const blocked = grip && blockedHomeGrip(grip);
    let reply;
    let alreadyDone = false;
    if (grip ? current.gripJob || state.mosGrip : current.curtainJob?.closed === curtainsClosed) {
      reply = say('Give me a moment to finish the current action.', '稍等，我正在完成上一项操作。');
    } else if (blocked) {
      reply = say(`${zoneLabels[blocked]} is marked as a No-Go Zone.`, `${zoneLabelsZh[blocked]}目前是禁入区。`);
    } else if (grip && state.mosHeld) {
      const item = items[state.mosHeld];
      reply = say(`I’m holding the ${item.name}. Ask me to put it back first.`, `机械手正拿着${item.zh}，请先让我把它放回去。`);
    } else if (napkin) {
      if (current.receivedItems?.includes('napkin')) {
        reply = say('You already have the napkin.', '餐巾纸已经在你手里了。');
      } else if (!state.camera) {
        reply = say('Open the shutter card to let me bring you a napkin.', '请手动打开快门，我就能把餐巾纸递给你。');
      } else {
        startHomeGrip(grip);
        state.actionText = 'Moves to pick up the napkin and carries it to you.';
        reply = say('I’ll bring you a napkin.', '我给你拿一张餐巾纸。');
      }
    } else if (light) {
      if ((current.lightsOn !== false) === lightsOn) {
        alreadyDone = true;
        reply = lightsOn ? say('The bedside light is already on.', '床头灯已经开着了。') :
          say('The bedside light is already off.', '床头灯已经关了。');
      } else if (holdingNapkin) {
        reply = say('Ask me to finish handing you the napkin first.', '请先让我把手里的餐巾纸递给你。');
      } else {
        startHomeGrip(grip);
        state.actionText = 'Moves to the wall switch and reaches for it with the gripper.';
        reply = say('I’ll press the wall switch.', '我去按墙上的开关。');
      }
    } else if (Boolean(current.curtainsClosed) === curtainsClosed) {
      alreadyDone = true;
      reply = curtainsClosed ? say('The demo curtains are already closed.', '演示里的窗帘已经拉上了。') :
        say('The demo curtains are already open.', '演示里的窗帘已经拉开了。');
    } else {
      state.flowRoom = {...current, curtainsClosed, curtainJob:{closed:curtainsClosed,zh,chat,nextEffect}};
      state.actionText = curtainsClosed ?
        'Sends Close to the demo smart-home service. The curtain motor draws both panels together.' :
        'Sends Open to the demo smart-home service. The curtain motor draws the panels apart.';
      reply = curtainsClosed ?
        say('I’ll close the curtains through the demo smart-home service.', '我会通过演示智能家居服务拉上窗帘。') :
        say('I’ll open the curtains through the demo smart-home service.', '我会通过演示智能家居服务拉开窗帘。');
    }
    response(reply).ai = aiMode && chat;
    if (alreadyDone) continueHomeSceneAction({nextEffect,zh,chat});
  }

  function continueHomeSceneAction({nextEffect, zh, chat}) {
    if (nextEffect) startHomeSceneAction(nextEffect,{zh,chat});
  }

  function homeSceneEffect(phrase, zh) {
    const words = zh ? phrase.replace(/[\s,，:：]/gu,'')
      .replace(/^(?:请问|请|麻烦)?(?:你)?(?:能不能|可不可以|可以|能否|能)?(?:帮我|替我)?(?:先)?/u,'')
      .replace(/(?:好吗|可以吗|吧|吗)$/u,'') : phrase.trim();
    return Object.keys(homeSceneCommands).find(name => homeSceneCommands[name][zh ? 'zh' : 'en'].test(words));
  }

  function handleHomeSceneText(text, modality) {
    const phrase = text.normalize('NFKC').toLowerCase().trim()
      .replace(/^(?:(?:hey\s+)?(?:mos|robin)|莫斯)(?=$|[\s,，:：]|\p{Script=Han})[\s,，:：]*/u,'')
      .replace(/[.!?。！？]+$/u,'').trim().replace(/\s+/gu,' ');
    const zh = /\p{Script=Han}/u.test(phrase);
    let effect = homeSceneEffect(phrase,zh);
    let nextEffect;
    if (!effect) {
      const separator = zh ? /(?:[,，、]\s*)?(?:然后(?:\s*再)?|接着|再|并且?|和)|[,，、]/u :
        /[\s,]+(?:and(?: then)?|then)\s+/u;
      const steps = phrase.split(separator);
      if (steps.length !== 2) return false;
      [effect,nextEffect] = steps.map(step => homeSceneEffect(step,zh));
      if (!effect || !nextEffect || effect === 'serve-napkin' || nextEffect === 'serve-napkin') return false;
    }
    addMessage('user',text,null,modality).ai = aiMode;
    startHomeSceneAction(effect,{zh,chat:true,nextEffect});
    return true;
  }

  function homeSceneResult(job, en, cn, action) {
    state.actionText = action;
    response(job.zh ? cn : en).ai = aiMode && job.chat;
    chime();
  }

  async function closeConnectedCurtain() {
    if (!connectedCurtain || curtainRequestPending || state.scene !== 'bedtime') return;
    const requestedState = state;
    curtainRequestPending = true;
    let feedback = 'Could not confirm the Home Assistant request. Check the curtain in Home Assistant.';
    try {
      const result = await fetch('./ai/curtain', {
        method:'POST', credentials:'same-origin', cache:'no-store',
        headers:{'Content-Type':'application/json','X-MOS-Profile':memoryProfile},
        body:'{}', signal:AbortSignal.timeout(9000)
      });
      if (result.ok && (await result.json()).accepted === true) {
        feedback = 'Home Assistant accepted the close command. Check the curtain for its final position.';
      } else if (result.status === 403 || result.status === 409) {
        feedback = 'Reconnect MOS Chat with the account configured for Home Assistant.';
      }
    } catch {
      // A timeout does not establish whether the motor received the command.
    } finally {
      curtainRequestPending = false;
      if (state === requestedState && state.scene === 'bedtime') {
        response(feedback);
        renderReminder();
      }
    }
  }

  function itemQueueMarkup() {
    const active = state.mosGrip;
    if (!active?.queuedItem) return '';
    const action = gripItemAction(active);
    const steps = [{action,item:active.item},...state.mosQueue].map((job,index) =>
      '<li' + (index === 0 ? ' aria-current="step"' : '') + '>' +
      escape(active.mixedQueue ? itemActionLabel(job.action,job.item,false) : items[job.item].label) + '</li>');
    const label = active.mixedQueue ? 'Item queue' : action === 'put_back' ? 'Return queue' : 'Delivery queue';
    return '<div class="delivery-queue"><span>' + label + '</span><ol aria-label="' + label + '">' +
      steps.join('') + '</ol></div>';
  }

  function sceneControls() {
    const motionStop = (state.flowRoom.gripJob || state.mosGrip) ?
      button('mos-stop','Stop motion',{style:'stage-button'}) : '';
    if(state.scene === 'free') {
      if (motionStop || aiMode && (state.mosTarget || aiRequest)) {
        return '<div class="mos-room-actions">' +
          (motionStop || button('mos-stop','Stop motion',{style:'stage-button'})) + '</div>';
      }
      if (aiMode) return '';
      return '<p class="explore-hint">Select a room label to invite '+escape(state.alias||'Robin')+' over. Chat, Memory, and Settings are available in the app.</p>'+(state.followUpArea?'<div class="dialogue-options">'+button('why-not-follow','You: “Why aren’t you coming over?”',{style:'dialogue-choice'})+'</div>':'');
    }
    if (state.scene === 'leaving') {
      const toggle = state.doorOpen ? button('return', 'Return home', {style:'stage-button primary'}) :
        button('depart', 'Leave home', {style:'stage-button primary'});
      const ask = state.doorOpen && !state.choiceDone ?
        button('leave-choice', (state.alias || 'Robin') + ', what should I take?', {style:'dialogue-choice',value:'ask'}) : '';
      return '<div class="dialogue-options">' + toggle + ask +
        motionStop + '</div>';
    }
    if(window.companionFlows[state.scene]) {
      const steps=window.companionFlows[state.scene], index=state.flowIndex;
      const progress = '<div class="flow-progress">' +
        (index < 0 ? 'Ready' : escape(steps[index].title)) + '</div>';
      const connected = state.scene === 'bedtime' && connectedCurtain ?
        '<div class="dialogue-options">' + button('close-connected-curtain',
          curtainRequestPending ? 'Sending to Home Assistant…' : 'Close real curtains via Home Assistant',
          {style:'stage-button',disabled:curtainRequestPending}) + '</div>' : '';
      if (homeSceneBusy() || state.mosGrip) {
        return progress + '<p class="dialogue-caption" role="status">Action in progress…</p>' + motionStop;
      }
      const restriction = state.scene === 'keys' && index >= 1 && index < steps.length - 1 && keySearchRestriction();
      if (state.scene === 'keys' && state.keySearchEnded) {
        return '<div class="flow-progress">Search ended</div><div class="dialogue-options">' +
          button('replay-scene', 'Replay', { style: 'dialogue-choice' }) + '</div>';
      }
      if (restriction) {
        return progress + '<p class="dialogue-caption">' + escape(restriction) + '</p><div class="dialogue-options">' +
          (!state.camera ? '<p class="dialogue-caption">Open the shutter card in the room to use the camera.</p>' : '') +
          (!state.zones.entry ? button('allow-key-demo', 'Allow the entryway', { style: 'dialogue-choice' }) : '') +
          button('end-key-search', 'Keep permissions and end search', { style: 'dialogue-choice' }) + '</div>';
      }
      const next=steps[index+1];
      if (state.flowRoom.napkinPaused && !state.flowRoom.receivedItems?.includes('napkin')) {
        return progress + (state.camera ? '<div class="dialogue-options">' +
          button('retry-napkin', 'Continue napkin delivery', {style:'stage-button'}) + '</div>' :
          '<p class="dialogue-caption manual-cover">Open the shutter card in the room to continue.</p>');
      }
      if (cameraRequired(next) && !state.camera) {
        return progress + '<p class="dialogue-caption manual-cover">Open the shutter card in the room to continue.</p>' + connected;
      }
      const label=index<0?'Begin':next?.user?'You: “'+next.user.replaceAll('{name}',state.alias||'Robin')+'”':next?.view==='screenshot'?'Take a screenshot':next?.view==='share'?'Share screenshot':next?.view==='attachment'?'Share to AI Assistant':'Next step →';
      return progress + '<div class="dialogue-options">'+
        (index===steps.length-1?button('replay-scene','Replay',{style:'dialogue-choice'}):button(index<0?'flow-start':'flow-next',label,{style:'dialogue-choice'+(next?.effect==='camera-on'?' manual-cover':'')}))+'</div>' + connected;
    }
    if(state.choiceDone) return '<div class="dialogue-options">' + button("replay-scene", "Replay", {style:"dialogue-choice"}) + '</div>';
    const name = state.alias || "Robin";
    const choice = (action, label, value = "") => button(action, label, {style:"dialogue-choice",value});
    let options = "";
    if(state.scene === "keys") options = choice("search-keys", name + ", where are my keys?");
    else if(state.scene === "privacy") options = choice("shutter", state.camera ? "Close the shutter" : "Open the shutter by hand") + choice("prompt", name + ", remind me to submit my assignment at 8 pm.", "reminder");
    else options = choice("setup-open", "Let’s set things up.");
    return '<div class="dialogue-caption">What would you like to do?</div><div class="dialogue-options">'+options+'</div>';
  }

  function legacySceneControls() {
    const primary = "stage-button primary";
    const secondary = "stage-button";
    let controls;
    if (state.scene === "keys") {
      controls = (state.camera && state.zones.entry ? "" : button("allow-entry", "Enable entryway", { style: primary })) +
        button("observe", "Load key observation", { style: state.camera && state.zones.entry && !state.records.keys ? primary : secondary }) +
        button("prompt", "Ask about keys", { style: state.records.keys && !state.spotlight ? primary : secondary, value: "keys" }) +
        (state.spotlight ? button("found", "Found it", { style: primary }) : "");
    } else if (state.scene === "leaving") {
      controls = (state.autonomy === "ask" || !Object.values(state.sources).every(Boolean) ?
        button("allow-suggestions", "Allow suggestions & sources", { style: secondary }) : "") +
        (!state.doorOpen ? button("depart", "Simulate leaving", { style: primary }) : button("return", "Return home", { style: secondary })) +
        button("prompt", "Ask what to take", { style: secondary, value: "leaving" });
    } else if (state.scene === "privacy") {
      controls = button("shutter", state.camera ? "Close shutter" : "Open shutter", { style: primary }) +
        button("observe", "Try a new observation", { style: secondary }) +
        button("prompt", "Set a reminder", { style: secondary, value: "reminder" });
    } else {
      controls = button("setup-open", "Open setup", { style: primary });
    }
    return "<p>" + scenes[state.scene].hint + '</p><div class="studio-actions">' + controls + '</div>';
  }

  function indicateCurrent(container, current) {
    for (const control of container.querySelectorAll("[data-value]")) {
      if (control.dataset.value === current) control.setAttribute("aria-current", "true");
      else control.removeAttribute("aria-current");
    }
  }

  function render() {
    const previousFocus = document.activeElement?.dataset.focus;
    saveBrowserMemory();
    const locked = permissionsLocked();
    const modelStatus = state.camera ? "Camera on" : "Camera off";
    const phoneStatus = state.camera ? "Camera on · " + zoneCount() +
      (zoneCount() === 1 ? " area" : " areas") : modelStatus;
    $("#scene-title").textContent = scenes[state.scene].title;
    $("#scene-description").textContent = scenes[state.scene].description;
    $("#model-camera span").textContent = modelStatus;
    $("#model-camera").classList.toggle("is-active", state.camera);
    const detail = $("#device-detail");
    const shutterChanged = detail.classList.contains("is-active") !== state.camera;
    detail.classList.toggle("is-active", state.camera);
    detail.setAttribute("aria-pressed", String(state.camera));
    detail.title = state.camera ? "Close camera shutter" : "Open camera shutter";
    if (shutterChanged) {
      detail.classList.remove("flash-shutter");
      requestAnimationFrame(() => detail.classList.add("flash-shutter"));
    }
    $("#shutter-state").textContent = state.camera ? "Shutter open" : "Shutter closed";
    const gantry = state.rail === "gantry";
    $("#rail-summary").textContent = gantry ? "Two fixed rails · one moving beam" : "One curved rail · guided route";
    $("#track-key").textContent = gantry ? "Y · Side rails" : "Ceiling track";
    $("#bridge-key").hidden = !gantry;
    for (const option of $("#rail-switch").querySelectorAll("button")) {
      option.setAttribute("aria-pressed", String(option.dataset.value === state.rail));
    }
    $("#companion-title").textContent = state.alias || "Robin";
    $("#companion-status").textContent = phoneStatus;
    $("#camera-explanation").textContent = state.camera ? "(Camera is on)" : "(Camera is off)";
    indicateCurrent($("#scenes"), state.scene);
    $('#scenes [data-value="leaving"]').textContent =
      state.scene === 'leaving' && state.doorOpen ? 'Return home' : 'Leaving home';
    const sheetOpen = state.panel === "settings" || state.panel === "setup";
    const mailView = state.scene === 'exam' && ['mail','screenshot','share'].includes(window.companionFlows.exam[state.flowIndex]?.view);
    $('.companion').classList.toggle('external-mail', mailView && !sheetOpen);
    indicateCurrent($("#phone-nav"), sheetOpen ? basePanel : state.panel);
    $("#scene-controls").innerHTML = itemQueueMarkup() + sceneControls();
    $("#privacy-shortcuts").innerHTML = '<span class="shortcut-label">Demo permissions</span><label class="demo-select">Suggestions<select id="suggestion-mode"><option value="ask" '+(state.autonomy === "ask"?'selected':'')+'>Low-Profile</option><option value="balance">Balance · Demo unavailable</option><option value="suggest" '+(state.autonomy === "suggest"?'selected':'')+'>Proactive</option></select></label>'+zonePermissionList()+'<label class="demo-select">Camera<select id="demo-camera"><option value="on" '+(state.camera?'selected':'')+'>On</option><option value="off" '+(!state.camera?'selected':'')+'>Off</option></select></label><label class="demo-select">Demo weather<select id="demo-weather"><option value="rain" '+(state.demoWeather==='rain'?'selected':'')+'>Rain expected today</option><option value="dry" '+(state.demoWeather==='dry'?'selected':'')+'>Dry today</option></select></label><div id="demo-feedback" role="status"></div>';
    const panel = { chat, reminders, settings, setup };
    if (!sheetOpen) {
    $("#phone-content").innerHTML = panel[state.panel]();
      $("#phone-content").dataset.panel = state.panel;
      const composer=$('#phone-content .composer');
      if(composer)composer.insertAdjacentHTML('afterbegin',voiceControl());
      if(state.panel==='chat' && state.freeReference){const ref=document.createElement('div');ref.className='free-reference';ref.textContent='Reference: '+state.freeReference;ref.insertAdjacentHTML('beforeend',button('dismiss-reference','×'));$('#phone-content .chat-bottom').prepend(ref);}
    }
    $("#settings-sheet").classList.toggle("open", sheetOpen);
    $("#settings-sheet").setAttribute("aria-hidden", String(!sheetOpen));
    $("#settings-sheet").inert = !sheetOpen;
    $("#settings-body").innerHTML = sheetOpen ? panel[state.panel]() : "";
    $('#locked-note').hidden=!locked;
    $('#privacy-shortcuts').querySelectorAll('select').forEach(el=>el.disabled=el.id !== 'demo-camera' &&
      (locked || (el.dataset.setting==='area-permission'&&!canEditZone(el.dataset.key))));
    if(locked)$('#settings-body').querySelectorAll('select,[data-setting=no-go]').forEach(el=>el.disabled=true);
    $('.room-view').classList.toggle('explorable',state.scene==='free');
    const count = $("#reminder-count");
    count.textContent = state.reminders.length;
    count.hidden = state.reminders.length === 0;
    const caption = $("#room-caption");
    typeCaption(caption, state.caption);
    renderNarrative();
    caption.hidden = true;
    const room = $("#room-canvas");
    const mappedResident = markingResident();
    const homeGrip = state.flowRoom.gripJob;
    const homeReceived = state.flowRoom.receivedItems || [];
    const receivedItems = receivedRoomItems();
    const curtain = state.flowRoom.curtainJob;
    const curtainStatus = curtain ? (curtain.closed ? 'closing' : 'opening') :
      state.flowRoom.curtainsClosed ? 'closed' : 'open';
    const mosActive = state.mosTarget && (mappedResident || state.zones[mosDestinationZone()]) &&
      (state.camera || state.mosMode);
    const mosLight = mosActive && state.camera && state.mosMode === 'locate' && !mappedResident;
    const received = items[receivedItems.at(-1)];
    room.setAttribute("aria-label", "Isometric apartment with a kitchen counter, desk, and bed by a curtained window. " +
      (gantry ? "XY gantry. " : "S-track. ") + modelStatus +
      (mosLight ? ". Spotlight on " + roomTargets[state.mosTarget].name :
        state.spotlight ? ". Spotlight on the entryway tray" : ". Spotlight off") +
      (mosActive && state.mosMode === 'look_at' ? ". Lens aimed at " + roomTargets[state.mosTarget].name : "") +
      (state.scene === 'free' ? ". Your character is in the " + zoneLabels[state.freeActor.zone].toLowerCase() : "") +
      (state.scene === 'leaving' ? (state.doorOpen ? ". Your character is on the doorstep" :
        ". Your character is just inside the front door") : "") +
      (state.mosHeld ? ". Gripper holding " + items[state.mosHeld].name : "") +
      (received ? ". Resident received the " + received.name : "") +
      ". The room contains glasses, an umbrella, keys, and a backpack" +
      (state.doorOpen ? ". Entryway door open" : ". Entryway door closed") +
      (homeReceived.includes('napkin') ? '. Your character received the napkin' : '. Napkin on the kitchen counter') +
      '. Bedside light ' + (state.flowRoom.lightsOn === false ? 'off' : 'on') +
      '. Smart curtains ' + curtainStatus);
    window.companionRoom.show({
      rail: state.rail,
      camera: state.camera,
      zones: Object.keys(state.zones).filter(key => state.zones[key]),
      target: state.scene === 'free' ? state.freeTarget : state.spotlight ? "entry" : state.doorOpen && state.zones.entry ? "door" : "idle",
      spotlight: state.spotlight,
      doorOpen: state.doorOpen,
      actor:state.scene === 'free' ? state.freeActor :
        state.scene === 'leaving' ? (state.doorOpen ? leavingActors.away : leavingActors.home) :
        homeSceneActors[state.scene] || defaultResident,
      residentControls:state.scene === 'free',
      residentSelected:state.scene === 'free' && state.residentSelected,
      night:state.scene === 'bedtime',
      ...state.flowRoom,
      ...(state.scene === 'keys' && keySearchRestriction() ? {target:'idle',inspect:null,spotlight:false} : {}),
      heldItem:state.flowRoom.heldItem || state.mosHeld,
      receivedItems:state.flowRoom.napkinLast ? [...receivedItems,...homeReceived] : [...homeReceived,...receivedItems],
      ...(mosActive ? {
        target:state.mosMode === 'look_at' || mappedResident ? 'hold' :
          gripAtResident() || state.mosTarget === 'resident' ? 'recipient' : state.mosTarget,
        spotlight:mosLight, highlightItem:mosLight ? state.mosTarget : null,
        aim:state.mosMode === 'look_at' ? state.mosTarget : null,
        marker:state.mosMode ? state.mosTarget : null,
        gripJob:state.mosGrip
      } : {}),
      ...(homeGrip ? {
        target:homeGrip.action === 'press_switch' ? 'light_switch' : homeGrip.action === 'handover' ? 'recipient' : 'napkin',
        inspect:homeGrip.action === 'pick_up' ? 'napkin' : null,
        spotlight:false,
        gripJob:homeGrip
      } : {})
    });
    const transcript = $(".transcript");
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
    if (previousFocus) {
      const matching = [...document.querySelectorAll("[data-focus]")].find(el => el.dataset.focus === previousFocus);
      const nextStage = previousFocus.startsWith("stage:") ? $(".stage-button.primary") : null;
      (matching || nextStage)?.focus({ preventScroll: true });
    }
  }

  let basePanel = "chat", captionTimer, lastCaption = "";
  let flowTimer, flowPlaying=false, narrativeTimer, lastNarrative='';
  function permissionsLocked(){return ['cooking','bedtime','exam'].includes(state.scene)}
  function canEditZone(key){return !permissionsLocked() && (state.scene==='free'||key==='entry')}
  function zonePermissionList(){return '<details class="zone-permission-list" id="zone-permission-list" '+(state.zoneListOpen?'open':'')+'><summary>No-Go Zone <span>Area permissions</span></summary><div>'+Object.entries(zoneLabels).map(([key,label])=>'<label class="zone-permission-row"><span>'+label+'</span><select data-setting="area-permission" data-key="'+key+'"'+(!canEditZone(key)?' disabled':'')+'><option value="allowed" '+(state.zones[key]?'selected':'')+'>Allowed</option><option value="restricted" '+(!state.zones[key]?'selected':'')+'>Restricted</option></select></label>').join('')+'</div></details>'}
  function applyScenePermissions(){if(permissionsLocked()){state.zones.entry=true;state.autonomy='suggest';for(const key of Object.keys(state.sources))state.sources[key]=true;}}
  function cameraRequired(step) {
    return step?.effect === 'camera-on' || step?.requiresCamera;
  }
  function renderNarrative(){
    const shot=window.companionFlows[state.scene]?.[state.flowIndex];
    const title=state.speaker||'Scene';
    const speech=state.speech||'Choose an action to begin.';
    const action=state.actionText||state.flowNarrative||'Robin waits for your request.';
    const signature=title+speech+action;
    if(signature===lastNarrative)return;lastNarrative=signature;clearInterval(narrativeTimer);
    const box=$('#narrative-box');box.innerHTML='<span class="narrative-label"></span><div class="narrative-speech"></div><hr><span class="narrative-label">Robot action</span><div class="narrative-action"></div>';
    box.querySelector('.narrative-label').textContent=title;
    box.querySelectorAll('.narrative-label')[1].textContent='Action';
    const speechNode=box.querySelector('.narrative-speech'),actionNode=box.querySelector('.narrative-action');
    actionNode.textContent=action;
    if(shot?.effect==='camera-on')actionNode.classList.add('manual-cover');
    const text=(title==='Scene'?'':'“')+speech+(title==='Scene'?'':'”');let i=0;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){speechNode.textContent=text;return;}
    narrativeTimer=setInterval(()=>{speechNode.textContent=text.slice(0,++i);if(i>=text.length)clearInterval(narrativeTimer)},22);
  }
  function typeNarrative(node,text=''){if(text===lastNarrative)return;lastNarrative=text;clearInterval(narrativeTimer);let i=0;node.textContent='';narrativeTimer=setInterval(()=>{node.textContent=text.slice(0,++i);if(i>=text.length)clearInterval(narrativeTimer)},22)}
  function stopFlow(){clearTimeout(flowTimer);flowPlaying=false;}
  function scheduleFlow(){clearTimeout(flowTimer);if(!flowPlaying)return;const shot=window.companionFlows[state.scene][state.flowIndex];flowTimer=setTimeout(()=>{if(state.panel==='settings'||state.panel==='setup'){scheduleFlow();return;}advanceFlow();render();scheduleFlow()},Math.max(6500,(shot.text.length+(shot.assistant||'').length)*35+2500));}
  function resetFlow(){stopFlow();state.flowIndex=-1;state.keySearchEnded=false;state.flowRoom={};state.flowNarrative='';state.examReference=false;state.spotlight=false;state.doorOpen=false;state.choiceDone=false;state.caption='';state.speech='Choose an action to begin.';state.speaker='Scene';state.actionText='Robin waits for your request.';state.freeTarget='idle';state.messages[state.scene]=state.messages[state.scene].filter(message=>message.ai);state.panel='chat';applyScenePermissions();if(state.scene==='exam')state.reminders=state.reminders.filter(r=>!r.tag?.startsWith('exam'));window.companionRoom.resetMotion();}
  function advanceFlow(){
    const steps=window.companionFlows[state.scene];if(!steps||state.flowIndex>=steps.length-1){stopFlow();return;}
    if (homeSceneBusy() || state.mosGrip) return;
    if (state.scene === 'keys' && (state.keySearchEnded || (state.flowIndex >= 1 && keySearchRestriction()))) {
      stopFlow();
      return;
    }
    const shot=steps[state.flowIndex + 1],name=state.alias||'Robin';
    if (cameraRequired(shot) && !state.camera) { stopFlow(); return; }
    state.flowIndex += 1;
    const line=text=>text.replaceAll('{name}',name).replaceAll('Robin',name);
    state.panel='chat';state.flowNarrative=line(shot.text);state.flowRoom={...state.flowRoom,...shot.room};
    if(shot.user)addMessage('user',line(shot.user),null,shot.effect==='send-screenshot'?'text':'voice');
    if(shot.assistant)addMessage('assistant',line(shot.assistant),null,shot.effect==='exam-memory'?'text':'voice');
    speak(shot.assistant?line(shot.assistant):shot.text);
    state.speaker=shot.assistant?'Robot says':shot.user?'You say':'Scene';
    state.speech=line(shot.assistant||shot.user||shot.text);
    state.actionText=line(shot.text);
    if (Object.hasOwn(homeSceneCommands,shot.effect)) startHomeSceneAction(shot.effect);
    if(shot.effect==='key-memory')state.records.keys=keyRecord;
    if(shot.effect==='snooze'){const r=state.reminders.find(r=>r.id===1);if(r)r.time='22:40';}
    if(shot.effect==='camera-off')state.camera=false;
    if(shot.effect==='send-screenshot'){state.examReference=false;state.messages.exam[state.messages.exam.length-1].screenshot=true;}
    if(shot.effect==='exam-memory'){state.reminders=state.reminders.filter(r=>!r.tag?.startsWith('exam'));state.reminders.push({id:state.nextReminderId++,title:'Computer Science exam · Tomorrow',time:'09:00',tag:'exam-event',status:'Scheduled'},{id:state.nextReminderId++,title:'Wake up for exam · Tomorrow',time:'07:00',tag:'exam-wake',status:'Scheduled'});}
    if(shot.effect==='show-memory')state.panel='reminders';
    if(shot.effect==='reference-exam')state.examReference=true;
    if(shot.effect==='awake'){state.examReference=false;const r=state.reminders.find(r=>r.tag==='exam-wake');if(r)r.status='Skipped today · Already awake';state.flowRoom={night:false,actor:{x:5.6,y:4.4,pose:'standing'}};}
    if(state.flowIndex===steps.length-1)stopFlow();
  }
  function examMail(view){return '<div class="exam-mail"><div class="mail-brand">Campus Mail</div><h3>Exam notice</h3><small>Academic Office · Today 10:26</small><h4>Computer Science Examination</h4><p>Your examination is scheduled for tomorrow at <b>9:00 AM</b>.</p><p>Please arrive 15 minutes early and bring your student ID.</p>'+(view==='screenshot'?'<div class="screenshot-flash"></div><button class="ios-screenshot" data-action="flow-next" aria-label="Share screenshot"><span class="mini-mail"><b>Campus Mail</b><strong>Exam notice</strong><small>Computer Science Examination</small><p>Tomorrow · 9:00 AM</p></span><span class="screenshot-tag">Screenshot · PNG</span></button>':'')+(view==='share'?'<div class="ios-share-shade"></div><div class="ios-share-sheet"><div class="sheet-handle"></div><div class="share-image-heading"><div class="share-mini">▧</div><div><b>Exam notice screenshot</b><small>PNG image · Campus Mail</small></div></div><div class="share-app-row"><button data-action="flow-next" class="share-app"><span>R</span>AI Assistant</button></div>'+button('flow-next','Share to '+(state.alias||'Robin'),{style:'share-confirm'})+'</div>':'')+'</div>';}
  let feedbackTimer;
  let appFeedbackTimer;
  function appFeedback(text){let node=$('#app-feedback');if(!node){node=document.createElement('div');node.id='app-feedback';node.setAttribute('role','status');$('.companion').append(node)}node.textContent=text;node.classList.add('visible');clearTimeout(appFeedbackTimer);appFeedbackTimer=setTimeout(()=>node.classList.remove('visible'),3000)}
  window.addEventListener('companion-resident-select', () => {
    if (state.scene !== 'free' || state.mosGrip || state.flowRoom.gripJob) return;
    state.residentSelected = !state.residentSelected;
    render();
  });
  window.addEventListener('companion-resident-move', ({detail:{actor,keepSelected}}) => {
    if (state.scene !== 'free' || state.mosGrip || state.flowRoom.gripJob) return;
    state.freeActor = actor;
    state.residentSelected = keepSelected;
    state.followUpArea = null;
    const area = zoneLabels[actor.zone].toLowerCase();
    state.actionText = `You move to the ${area}.`;
    if (state.mosTarget === 'resident' && !markingResident() && !state.zones[actor.zone]) {
      stopMOS(true);
      state.actionText += ' Robin stays out of the No-Go Zone.';
    }
    $("#announcement").textContent = state.actionText;
    render();
  });
  window.addEventListener('companion-area',event=>{
    if(state.scene!=='free'||state.mosGrip||state.flowRoom.gripJob)return;
    const area = event.detail;
    const destination = areaStops[area];
    const actor = destination && planResidentMove(destination.x,destination.y);
    if (!actor) return;
    stopMOS();
    state.panel = 'chat';
    state.freeActor = actor;
    state.followUpArea=null;
    if(!state.zones[actor.zone]){response('Hey, I’m here. Need anything?','voice');state.followUpArea=area;state.actionText='You move to the '+area.toLowerCase()+'. '+(state.alias||'Robin')+' stays outside its boundary, respecting your No-Go Zone.';}
    else{state.freeTarget=destination.target;response('Hey! Coming over.','voice');state.actionText='You move to the '+area.toLowerCase()+'. '+(state.alias||'Robin')+' follows you along the rail.'+(!state.camera?' The camera remains off.':'');}
    render();
  });
  window.addEventListener('companion-resident-arrived', () => {
    if (checkRainReminder()) renderReminder();
  });
  window.addEventListener('companion-grip-transferred', ({detail: job}) => {
    if (state.flowRoom.gripJob === job) {
      if (job.action === 'press_switch') {
        state.flowRoom.lightsOn = job.lightsOn;
        if (job.lightsOn) {
          homeSceneResult(job,'The bedside light is on.','床头灯打开了。','The gripper presses the wall switch and the bedside light comes on.');
        } else {
          homeSceneResult(job,'The bedside light is off.','床头灯关好了。','The gripper presses the wall switch and the bedside light goes out.');
        }
      } else if (job.action === 'pick_up') {
        state.flowRoom.heldItem = 'napkin';
      } else if (job.action === 'handover') {
        state.flowRoom.heldItem = null;
        state.flowRoom.receivedItems = ['napkin'];
        state.flowRoom.napkinLast = true;
        homeSceneResult(job,'Here’s your napkin.','餐巾纸递给你了。','Your character receives the napkin from the gripper.');
      }
      renderReminder();
      return;
    }
    if (state.mosGrip !== job) return;
    state.mosHeld = job.action === 'pick_up' || job.action === 'take_back' ? job.item : null;
    const item = items[job.item];
    if (job.action === 'handover') {
      state.mosReceived = [...state.mosReceived, job.item];
      state.flowRoom.napkinLast = false;
      if (job.item === 'umbrella' && state.rainReminder && job.rainDate === state.rainReminder.date) {
        state.rainReminder.delivered = true;
      }
      response(job.zh ? `已经把${item.zh}交给你了。` : `I’ve handed you the ${item.name}.`).ai = true;
    } else if (job.action === 'take_back') {
      state.mosReceived = state.mosReceived.filter(id => id !== job.item);
      if (job.item === 'keys') state.flowRoom.keysCollected = false;
    } else if (job.action === 'put_back') {
      response(job.zh ? `已经把${item.zh}放回${item.placeZh}了。` : `I’ve put the ${item.name} back ${item.place}.`).ai = true;
    }
  });
  window.addEventListener('companion-grip-finished', ({detail: job}) => {
    if (state.flowRoom.gripJob === job) {
      if (job.action === 'pick_up') {
        state.flowRoom.gripJob = {...job,action:'handover'};
        state.actionText = 'Carries the napkin along the rail, then lowers it to your hand.';
      } else {
        settleHomeGrip();
        continueHomeSceneAction(job);
        checkRainReminder();
      }
      renderReminder();
      return;
    }
    if (state.mosGrip !== job) return;
    const item = items[job.item];
    if (job.action === 'pick_up') {
      state.mosGrip = job.delivery ? {...job, action:'handover'} : null;
      state.actionText = job.delivery ? `Carries the ${item.name} to you.` : `The gripper is holding the ${item.name}.`;
    } else if (job.action === 'take_back') {
      state.mosGrip = {...job, action:'put_back'};
      state.actionText = `Carries the ${item.name} back to its original spot.`;
    } else {
      state.mosGrip = null;
      if (job.action === 'handover') {
        state.mosTarget = null;
        state.freeTarget = 'hold';
        state.actionText = `The resident received the ${item.name}.`;
      } else {
        state.actionText = `The ${item.name} is back ${item.place}.`;
      }
      continueItemQueue(job.mixedQueue);
    }
    checkRainReminder();
    renderReminder();
  });
  window.addEventListener('companion-curtain-finished', ({detail:job}) => {
    if (state.flowRoom.curtainJob !== job) return;
    state.flowRoom.curtainJob = null;
    if (job.closed) {
      homeSceneResult(job,'The demo curtains are closed.','演示里的窗帘已经拉上了。','Both curtain panels meet in the middle of the window.');
    } else {
      homeSceneResult(job,'The demo curtains are open.','演示里的窗帘已经拉开了。','Both curtain panels stop at the sides of the window.');
    }
    continueHomeSceneAction(job);
    renderReminder();
  });
  function demoFeedback(text){let node=$("#demo-feedback");if(state.panel === "settings" || state.panel === "setup"){node=$("#settings-feedback");if(!node){node=document.createElement('div');node.id='settings-feedback';$("#settings-body").append(node)}}node.textContent=text;clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>{node.textContent=''},2800)}
  function typeCaption(node, text) {
    if(text === lastCaption) return;
    lastCaption = text; clearInterval(captionTimer); node.textContent = "";
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) {node.textContent=text;return;}
    let index=0; captionTimer=setInterval(()=>{node.textContent=text.slice(0,++index);if(index>=text.length)clearInterval(captionTimer)},24);
  }
  const actions = {
    'why-not-follow'(){if(!state.followUpArea)return;addMessage('user','Why aren’t you coming over?',null,'voice');response('You marked the '+state.followUpArea.toLowerCase()+' as a No-Go Zone, so I’m staying out. You can change that in Settings.','voice');state.actionText='Stays outside the restricted area until you change its permission.';state.followUpArea=null;},
    'app-demo'(text){appFeedback(text);},
    'voice-message': toggleVoice,
    'reference-memory'(text){state.freeReference=text;state.examReference=false;state.panel='chat';},
    'dismiss-reference'(){state.freeReference='';},
    'flow-start'(){if (!homeSceneActors[state.scene]) resetFlow();advanceFlow();},
    'flow-next'(){clearTimeout(flowTimer);advanceFlow();scheduleFlow();},
    'flow-pause'(){flowPlaying=!flowPlaying;scheduleFlow();},
    'retry-napkin': () => startHomeSceneAction('serve-napkin'),
    'close-connected-curtain': () => { void closeConnectedCurtain(); },
    'allow-key-demo'() {
      if (state.scene !== 'keys' || state.flowIndex < 1 || state.keySearchEnded || !keySearchRestriction()) return;
      setting('zones', 'entry', true);
      advanceFlow();
    },
    'end-key-search'() {
      if (state.scene !== 'keys' || state.flowIndex < 1 || state.keySearchEnded || !keySearchRestriction()) return;
      state.keySearchEnded = true;
      state.flowRoom = {...state.flowRoom, target:'idle', inspect:null, spotlight:false};
      stopFlow();
      response(state.camera ? "The entryway is outside the allowed area. I’ll stay here." :
        "The camera is off. I’ll stay here.", 'voice');
      state.actionText = 'Robin stays in place with the current permissions.';
    },
    'reference-exam'(){state.panel='chat';state.examReference=true;},
    "search-keys"() {
      state.panel="chat";addMessage("user",(state.alias || "Robin")+", where are my keys?");
      state.spotlight=false;
      if(!state.camera) response("My camera is off, so I cannot see anything. I will stay here.");
      else if(!state.zones.entry) response("I could not find them in the areas I can reach. They might be in the entryway. (The entryway is a No-Go Zone, so I cannot go there.)");
      else {state.records.keys=keyRecord;state.spotlight=true;response("Found them on the entryway tray. I am pointing the light at them.");}
    },
    "replay-scene"() {resetFlow();state.departure=null;state.freeReference='';state.followUpArea=null;},
    "leave-choice"(value) {
      simulateDeparture();
      addMessage("user", value === "ask" ? (state.alias || "Robin") + ", I’m heading out. What should I take?" : "I’m heading out.",null,'voice');
      const text = value === "ask" || state.autonomy === "suggest" ? departureAdvice().text || "Take care. Check that you have everything you need." : "Bye! Have a good day.";
      response(text,'voice');
    },
    "toggle-suggestions"() { const on = state.autonomy !== "suggest"; for(const key of Object.keys(state.sources)) state.sources[key] = on; setting("autonomy", "", on ? "suggest" : "ask"); },
    "toggle-no-go"() { const allow = !state.zones.entry; setting("zones", "entry", allow); if(allow && state.camera) state.records.keys = keyRecord; },
    rail(value) { if (!state.mosGrip && !homeSceneBusy()) state.rail = value; },
    "preview-motion"() { if (!state.mosGrip && !homeSceneBusy()) window.companionRoom.preview(); },
    'mos-prompt'(text) { if (aiMode && state.scene === 'free') void submitAI(text); },
    'mos-stop'() {
      aiRequest?.abort();
      aiRequest = null;
      if (stopHomeGrip() || stopMOS()) state.actionText = 'Motion stopped.';
    },
    scene(value) {
      if (value === state.scene) {
        if (value === 'leaving') {
          if (state.doorOpen) returnHome();
          else simulateDeparture();
        }
        return;
      }
      stopVoice();
      aiRequest?.abort();
      aiRequest = null;
      aiError = '';
      if (permissionsLocked()) {
        state.camera = false;
        state.zones = {...preferredPermissions.zones};
        state.sources = {...preferredPermissions.sources};
        state.autonomy = preferredPermissions.autonomy;
      }
      stopMOS();
      state.residentSelected = false;
      state.chatDraft = '';
      state.chatDraftModality = 'text';
      state.freeReference='';state.followUpArea=null;
      stopFlow();
      state.choiceDone = false;
      state.scene = value;
      state.panel = value === "setup" ? "setup" : "chat";
      state.caption = "";
      resetFlow();
      if (value === 'leaving') simulateDeparture();
    },
    panel(value) { if(value === "settings" && state.panel !== "settings" && state.panel !== "setup") basePanel = state.panel; state.panel = value; },
    "close-settings"() { state.panel = basePanel; },
    reset() {
      stopVoice();
      stopFlow();
      aiRequest?.abort();
      aiRequest = null;
      aiHistory = [];
      aiError = '';
      state = initialState();
      basePanel = 'chat';
      lastSnapshot = memorySnapshot();
      let announcement = memoryKey ? emptyAnnouncement : 'Demo reset. Browser memory could not be cleared.';
      if (memoryKey) {
        try {
          window.localStorage.removeItem(memoryKey);
          lastStoredMemory = null;
          memoryAvailable = true;
        } catch {
          memoryAvailable = false;
          announcement = 'Demo reset. Browser memory could not be cleared.';
        }
      }
      $('#demo-options').open=true;
      window.companionRoom.resetMotion();
      $("#announcement").textContent = announcement;
    },
    "allow-entry"() {
      state.zones.entry = true;
    },
    observe() {
      state.panel = "chat";
      observe();
    },
    prompt(value) { handlePrompt((state.alias || "Robin") + ", " + commands[value]); },
    found() {
      state.spotlight = false;
      response("Search complete. Spotlight off.");
    },
    "allow-suggestions"() {
      for (const source of Object.keys(state.sources)) state.sources[source] = true;
      setting("autonomy", "", "suggest");
      speak("Departure suggestions enabled for calendar, weather and the item checklist.");
    },
    depart: simulateDeparture,
    return: returnHome,
    "departure-result"(value) {
      state.departure.status = value;
      speak(value === "accepted" ? "Suggestion acknowledged." : "Suggestion dismissed.");
    },
    adjust() { state.panel = "settings"; },
    shutter() { setCamera(!state.camera); },
    "cancel-reminder"() { state.pendingReminder = null; speak("Reminder cancelled."); },
    "cancel-rain-reminder"() {
      if (state.mosGrip?.rainDate) stopMOS();
      state.rainReminder = null;
      speak("Reminder cancelled.");
    },
    "delete-reminder"(value) {
      state.reminders = state.reminders.filter(reminder => reminder.id !== Number(value));
      speak("Reminder deleted.");
    },
    "delete-observation"() {
      state.records.keys = null;
      state.spotlight = false;
      for (const messages of Object.values(state.messages)) {
        for (let index = messages.length - 1; index >= 0; index -= 1) {
          if (messages[index].record) messages.splice(index, 1);
        }
      }
      speak("Observation deleted.");
    },
    "setup-open"() { state.panel = "setup"; },
    "skip-setup"() {
      state.panel = "chat";
      speak("Setup skipped. " + (state.camera ? "Current settings kept." : "Camera off."));
    }
  };

  document.addEventListener("click", event => {
    const control = event.target.closest("button[data-action]");
    if (!control) return;
    if(control.dataset.action==='app-demo'){appFeedback(control.dataset.value);return;}
    const isChoice = control.classList.contains("dialogue-choice") && !['replay-scene','flow-start','flow-next','flow-pause','allow-key-demo','end-key-search','why-not-follow'].includes(control.dataset.action);
    if(isChoice && state.choiceDone) return;
    actions[control.dataset.action]?.(control.dataset.value);
    if(isChoice) state.choiceDone=true;
    render();
    if(isChoice && control.dataset.action === "search-keys" && state.camera && !state.zones.entry) window.companionRoom.preview();
  });

  document.addEventListener("change", event => {
    const field = event.target;
    if(field.dataset.setting==='no-go'||field.dataset.setting==='area-permission'){
      const key=field.dataset.key;
      if(!canEditZone(key)){demoFeedback('This area is fixed for this demo scene.');render();return;}
      setting('zones',key,field.dataset.setting==='no-go'?!field.checked:field.value==='allowed');
      if(state.panel!=='setup')render();else saveBrowserMemory();return;
    }
    if(field.dataset.setting==='preferences'){state.sound=field.checked;saveBrowserMemory();return;}
    if(permissionsLocked() && (['suggestion-mode','no-go-mode'].includes(field.id) || field.dataset.setting)){demoFeedback('Permissions are fixed for this demo scene.');render();return;}
    if(field.id === "suggestion-mode") {
      if(field.value === "balance") { field.value=state.autonomy;demoFeedback("Balance mode is not available in this demo."); return; }
      setting("autonomy", "", field.value);render();return;
    }
    if(field.id === "no-go-mode") {if(field.value === "demo"){field.value=state.zones.entry?'off':'on';demoFeedback("This area is not configurable in the demo.");return;}setting("zones","entry",field.value === "off");render();return;}
    if(field.id === "demo-camera") {setCamera(field.value === "on");render();return;}
    if(field.id === 'demo-weather') {
      state.demoWeather = field.value;
      if (state.demoWeather === 'dry' && state.mosGrip?.rainDate) stopMOS();
      checkRainReminder();
      render();
      return;
    }
    const group = field.dataset.setting;
    if(group === "entry-access"){if(field.value === "demo"){field.value=state.zones.entry?'allowed':'restricted';demoFeedback("This area is not configurable in the demo.");return;}setting("zones","entry",field.value === "allowed");if(state.panel !== "setup")render();return;}
    if((group === "zones" || group === "setup") && (field.dataset.key === "study" || field.dataset.key === "living")){field.checked=state.zones[field.dataset.key];demoFeedback("This area is not configurable in the demo.");return;}
    if (!group || group === "setup") return;
    setting(group, field.dataset.key, field.type === "checkbox" ? field.checked : field.value);
    render();
  });

  document.addEventListener("toggle", event => {
    const detail = event.target;
    if(detail.id==='zone-permission-list'){state.zoneListOpen=detail.open;return;}
    if (!detail.matches("details.observation[open]")) return;
    const transcript = detail.closest(".transcript");
    const overflow = detail.getBoundingClientRect().bottom - transcript.getBoundingClientRect().bottom;
    if (overflow > 0) transcript.scrollTop += overflow + 6;
  }, true);

  document.addEventListener("input", event => {
    if (event.target.id !== 'chat-input') return;
    state.chatDraft = event.target.value;
    if (!state.chatDraft) state.chatDraftModality = 'text';
  });

  document.addEventListener("submit", event => {
    const form = event.target;
    if (!form.dataset.form) return;
    event.preventDefault();
    const data = new FormData(form);
    if (form.dataset.form === "chat") {
      const text = String(data.get("message") || "").trim();
      if (text) {
        const modality = state.chatDraftModality;
        state.chatDraft = '';
        state.chatDraftModality = 'text';
        stopVoice();
        form.reset();
        sendChatMessage(text,modality);
      }
      return;
    }
    if (form.dataset.form === "reminder" && state.pendingReminder) {
      const { title } = state.pendingReminder;
      const time = data.get("time");
      state.reminders.push({ id: state.nextReminderId, title, time });
      state.nextReminderId += 1;
      state.pendingReminder = null;
      response("Reminder saved for " + formatTime(time) + ".");
      chime();
    }
    if (form.dataset.form === "setup") {
      state.alias = data.get("alias").trim();
      state.sound = data.has("sound");
      if(!permissionsLocked()) {
      setting("autonomy", "", data.get("autonomy"));
      }
      state.panel = "settings";
      speak("Preferences saved. " + (state.camera ? "Camera on." : "Camera off."));
    }
    render();
  });

  $("#brand-name").textContent = PRODUCT_NAME;
  document.title = PRODUCT_NAME + " · Interactive prototype";
  const main = $("main");
  const resetButton = $('[data-action="reset"]');
  main.inert = true;
  resetButton.disabled = true;
  main.setAttribute('aria-busy','true');
  window.addEventListener('storage', event => {
    if (memoryKey && (event.key === null || (event.key === memoryKey && event.newValue === null))) {
      window.location.reload();
    }
  });
  window.addEventListener('pagehide', stopVoice);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && voiceRequest) {
      stopVoice();
      render();
    }
    if (!document.hidden) checkTimeReminders();
  });
  void startBrowserMemory().finally(() => {
    main.inert = false;
    resetButton.disabled = false;
    main.removeAttribute('aria-busy');
    render();
    checkTimeReminders();
    setInterval(checkTimeReminders,15000);
  });
})();
